"""Import planner data and unmodified artwork from the authors' mod checkouts.

Usage: python tools/import-mods.py [directory containing chapter1 and chapter2]
The source repositories are listed in MOD_SUPPORT.md. No game installation needed.
"""
import copy
import hashlib
import json
import pathlib
import re
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCES = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'node_modules/.mod-sources'
REPOS = {1: 'VanillaGravshipExpanded', 2: 'VanillaGravshipExpanded2'}
names, definitions, commits = {}, [], {}
for chapter in (1, 2):
    folder = SOURCES / f'chapter{chapter}'
    commits[chapter] = subprocess.check_output(['git', '-C', str(folder), 'rev-parse', 'HEAD'], text=True).strip()
    for file in sorted((folder / '1.6').rglob('*.xml')):
        if 'Defs' not in file.parts:
            continue
        for element in ET.parse(file).getroot().findall('ThingDef'):
            if element.get('Name'):
                names[element.get('Name')] = element
            if element.findtext('defName') and element.get('Abstract', '').lower() != 'true':
                definitions.append((chapter, file, element))

# Vanilla parent defaults needed by the mod definitions. Child XML overrides these.
defaults = {
    'GravshipComponentBase': '<ThingDef><rotatable>false</rotatable></ThingDef>',
    'ThrusterBase': '<ThingDef><rotatable>true</rotatable><designationCategory>VGE_Platform</designationCategory></ThingDef>',
    'Wall': '<ThingDef><rotatable>false</rotatable></ThingDef>',
    'BasicMechRecharger': '<ThingDef><designationCategory>Odyssey</designationCategory></ThingDef>',
    'StandardMechRecharger': '<ThingDef><designationCategory>Odyssey</designationCategory></ThingDef>',
}

def merge(parent, child):
    result = copy.deepcopy(parent)
    for item in child:
        prior = next((p for p in result if p.tag == item.tag and p.get('Class') == item.get('Class')), None)
        if prior is None or item.get('Inherit', '').lower() == 'false':
            if prior is not None:
                result.remove(prior)
            result.append(copy.deepcopy(item))
        elif item.tag == 'li' and not item.get('Class'):
            result.append(copy.deepcopy(item))
        elif len(item):
            result.remove(prior)
            result.append(merge(prior, item))
        else:
            prior.text = item.text
    return result

def resolve(element):
    parent = element.get('ParentName')
    base = resolve(names[parent]) if parent in names else ET.fromstring(defaults.get(parent, '<ThingDef/>'))
    return merge(base, element)

def pair(value):
    return [float(n) for n in re.findall(r'-?\d+(?:\.\d+)?', value or '(1,1)')]

def text(element, path, fallback=''):
    return element.findtext(path, fallback).strip()

def initial_cap(value):
    return value[:1].upper() + value[1:]

def specifications(element):
    result = {}
    labels = {'storedEnergyMax':('Battery storage',' Wd'), 'maxHeat':('Heat capacity',''), 'heatConsumptionPerHour':('Heat dissipated',' / h'), 'cooldownReductionPercent':('Cooldown reduction',''), 'storageCapacity':('Resource storage',''), 'powerGenerated':('Power from stored heat',' W')}
    for node in element.iter():
        if node.tag == 'basePowerConsumption' and node.text:
            value = float(node.text)
            result['Power'] = f'{abs(value):g} W '+('generation' if value < 0 else 'consumption')
        if node.tag in labels and node.text:
            label,unit=labels[node.tag]
            result[label] = node.text.strip()+unit
    return result

def system_properties(element):
    """Numeric planning data, separate from human-readable specifications."""
    result = {}
    for comp in element.iter('li'):
        kind = comp.get('Class','')
        network = text(comp,'pipeNet')
        if kind.endswith('CompProperties_ResourceStorage'):
            if network == 'VGE_OxygenNet':
                result['oxygenCapacity'] = float(text(comp,'storageCapacity','0'))
            elif network == 'VGE_AstrofuelNet':
                result.update(fuelCapacity=float(text(comp,'storageCapacity','0')),fuelKind='astrofuel')
        if 'ResourceTrader' in kind and comp.find('consumptionPerTick') is not None:
            rate = float(text(comp,'consumptionPerTick'))
            if kind.endswith('ResourceTrader_OxygenPusher'):
                result.update(pumpPerSecond=rate*60,airPerHundredPerSecond=float(text(comp,'airPerSecondPerHundredCells','0.1')),oxygenFromStorage=True)
            elif rate < 0 and network == 'VGE_OxygenNet':
                result.update(oxygenPerDay=-rate*600,atmosphereOnly='NotInVacuumBiome' in kind)
            elif rate < 0 and network == 'VGE_AstrofuelNet':
                result['fuelPerDay'] = -rate*600
        if kind.endswith('CompProperties_ResourceThruster') and network == 'VGE_AstrofuelNet':
            result['fuelKind'] = 'astrofuel'
        if 'Thruster' in kind:
            if comp.find('statOffsets/GravshipRange') is not None:
                result['range'] = float(text(comp,'statOffsets/GravshipRange'))
            if kind.endswith('CompProperties_ElectricThruster'):
                result.update(electric=True,requiredCharge=float(text(comp,'chargePercentRequiredToUse','1')))
        if comp.find('storedEnergyMax') is not None:
            result['energyCapacity'] = float(text(comp,'storedEnergyMax'))
        if kind.endswith('CompProperties_Heatsink'):
            for source,target in [('maxHeat','heatCapacity'),('heatConsumptionPerHour','heatDissipationPerHour'),('cooldownReductionPercent','cooldownReduction')]:
                result[target] = float(text(comp,source,'0'))
            result['heatUpgrades'] = [{node.tag:float(node.text) for node in upgrade if node.tag!='researchProject'} | {'research':text(upgrade,'researchProject')} for upgrade in comp.findall('upgrades/li')]
        if 'ShieldGeneratorWithHeat' in kind:
            result['activeShieldHeatPerHour'] = float(text(comp,'passiveHeatGeneration','1'))*10
        if kind.endswith('CompProperties_Refuelable'):
            fuel_type = text(comp,'fuelFilter/thingDefs/li')
            if fuel_type == 'VGE_Astrofuel':
                result['generatorFuelPerDay'] = float(text(comp,'fuelConsumptionRate','0'))
            if fuel_type == 'Chemfuel' and text(comp,'compClass').endswith('CompRefuelable_AstrofuelSynthesizer'):
                result['refiningChemfuelPerDay'] = float(text(comp,'fuelConsumptionRate','0'))
            if text(comp,'fuelLabel') == 'Oxyalgae':
                result['oxyalgaePerDay'] = float(text(comp,'fuelConsumptionRate','0'))
        if comp.find('fuelSavingsPercent') is not None:
            result['fuelSavings'] = float(text(comp,'fuelSavingsPercent'))
    return result

artwork = {}
def sprite(chapter, path):
    if not path:
        return None
    source = SOURCES / f'chapter{chapter}' / 'Textures' / (path + '.png')
    if not source.exists():
        return None
    target = ROOT / 'assets/mods' / f'chapter{chapter}' / (path + '.png')
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)  # Preserve the original artwork; no texture cleanup.
    relative = target.relative_to(ROOT / 'assets').as_posix()
    artwork[relative] = f'https://github.com/Vanilla-Expanded/{REPOS[chapter]}/blob/{commits[chapter]}/Textures/{path}.png'
    return relative

special = {
    'VGE_Astropurifier', 'VGE_OxygenReclaimer', 'VGE_GravshipBlackBox', 'VGE_FlightComputer',
    'VGE_GunnerSubpersonaCore', 'VGE_MaintenanceHub', 'VGE_CapacitorHarmonizer', 'VGE_Gravlift',
    'VGE_OperatorSubpersonaCore', 'VGE_GravshipBasicRecharger', 'VGE_GravshipStandardRecharger',
    'VGE_EmergencyGenerator', 'VGE_AstrofireLauncher', 'VGE_GravlaunchCloaker', 'VGE_Warcomputer', 'VGE_GravFieldDilutor',
}
groups = {'VGE_Fuel': 'Fuel network', 'VGE_Vacuum': 'Oxygen and vacuum', 'VGE_Combat': 'Combat', 'VGE_Platform': 'Platform'}
components, engines = [], []
for chapter, file, raw in definitions:
    if 'Mods' in file.parts and file.parts[file.parts.index('Mods') + 1] not in ('Biotech', 'Ideology', 'Royalty'):
        continue
    element = resolve(raw)
    name = text(element, 'defName')
    category = text(element, 'designationCategory')
    if not (category and category != 'VGE_Designer' or name in special):
        continue
    if not ('ThingDefs_Buildings' in file.parts or 'NetDefs' in file.parts):
        continue
    width, height = map(int, pair(text(element, 'size', '(1,1)')))
    description = text(element, 'description').replace('\\n', '\n')
    row = dict(id=name, name=initial_cap(text(element, 'label')), width=width, height=height,
               rotate=text(element, 'rotatable', 'true').lower() == 'true', chapter=chapter,
               group=groups.get(category, 'Ship furnishings'), symbol='VE', color='#b4a0d4', note=description,
               source=f'https://github.com/Vanilla-Expanded/{REPOS[chapter]}/blob/{commits[chapter]}/{file.relative_to(SOURCES / f"chapter{chapter}").as_posix()}')
    if 'Mods' in file.parts:
        row['requiresDlc'] = file.parts[file.parts.index('Mods') + 1]
        row['note'] = f'Requires {row["requiresDlc"]}. ' + row['note']
    comps = element.findall('comps/li')
    row['specs'] = specifications(element)
    row['systems'] = system_properties(element)
    facilities = [c for c in comps if c.find('maxSimultaneous') is not None and ('Gravship' in c.get('Class', '') or 'Thruster' in c.get('Class', '') or c.get('Class', '').endswith('CompProperties_SignalJammer'))]
    if facilities:
        maximum = min(int(text(c, 'maxSimultaneous')) for c in facilities)
        if maximum < 9999:
            row['limit'] = maximum
    workers = [w.text or '' for w in element.findall('placeWorkers/li')]
    if any(w.endswith('PlaceWorker_InRangeOfGravEngine') for w in workers):
        row['engineField'] = True
    if any(w.endswith('PlaceWorker_InRangeOfGravSource') for w in workers):
        row['sourceField'] = True
    for c in comps:
        if c.find('radius') is not None and c.get('Class') == 'CompProperties_SubstructureFootprint':
            row['fieldRadius'] = float(text(c, 'radius'))
        if c.find('statOffsets/SubstructureSupport') is not None:
            row['supportOffset'] = int(text(c, 'statOffsets/SubstructureSupport'))
        if c.find('statOffsets/VGE_SubstructureSupportMultiplier') is not None:
            row['supportMultiplier'] = float(text(c, 'statOffsets/VGE_SubstructureSupportMultiplier'))
        if c.find('exclusionAreaSize') is not None:
            row['exhaust'] = int(pair(text(c, 'exclusionAreaSize'))[-1])
            row['exhaustFacing'] = 'rotation'
        if c.find('statOffsets/GravshipRange') is not None:
            row['rangeOffset'] = float(text(c, 'statOffsets/GravshipRange'))
    if name in ('VGE_GravjumperEngine', 'VGE_GravhulkEngine'):
        row['support'] = int(text(element, 'statBases/SubstructureSupport'))
    path = text(element, 'graphicData/texPath')
    graphic = text(element, 'graphicData/graphicClass')
    sprites = {direction: found for direction in ('south', 'east', 'north', 'west') if (found := sprite(chapter, path + '_' + direction))}
    single = sprite(chapter, path)
    collection = SOURCES / f'chapter{chapter}' / 'Textures' / path
    if not single and collection.is_dir():
        first = next(iter(sorted(collection.glob('*.png'))), None)
        if first:
            single = sprite(chapter, first.relative_to(SOURCES / f'chapter{chapter}' / 'Textures').with_suffix('').as_posix())
    icon = sprite(chapter, text(element, 'uiIconPath'))
    if single and 'Atlas' not in path:
        sprites.setdefault('south', single)
    if not sprites.get('south'):
        # Linked atlases need a one-tile representation in the planner.
        sprites['south'] = sprites.get('north') or icon or single or next(iter(sprites.values()), None)
    if not sprites['south']:
        raise ValueError(f'No artwork for {name}: {path}')
    if 'Atlas' in path and single:
        sprites['south'] = single
        row['atlas'] = True
    row['sprites'] = sprites
    draw_size = pair(text(element,'graphicData/drawSize',f'({width},{height})'))
    row['drawSize'] = draw_size * 2 if len(draw_size) == 1 else draw_size
    if icon:
        row['icon'] = icon
    top = sprite(chapter, text(element, 'building/turretTopTexPath'))
    if top:
        row['topSprite'] = top
        row['topDrawSize'] = float(text(element,'building/turretTopDrawSize',str(max(width,height))))
    for path_node in ('building/doorTopGraphic/texPath','comps/li/bedTopGraphicDatas/li/texPath'):
        top_path = text(element,path_node)
        if top_path:
            top_sprites = {direction: found for direction in ('south','east','north','west') if (found := sprite(chapter,top_path+'_'+direction))}
            if single_top := sprite(chapter,top_path):
                top_sprites.setdefault('south',single_top)
            if top_sprites:
                row['topSprites'] = top_sprites
    if name in ('VGE_AstrofuelPipe', 'VGE_HiddenAstrofuelPipe', 'VGE_AstrofuelValve', 'VGE_OxygenPipe', 'VGE_HiddenOxygenPipe', 'VGE_OxygenValve'):
        row['network'] = 'oxygen' if 'Oxygen' in name else 'fuel'
    if name in ('VGE_WallFirefoamPopper', 'VGE_WallOrbitalTradeBeacon', 'VGE_WallToolCabinet'):
        row['wallMounted'] = True
    if name in ('VGE_GravshipStructuralBeam', 'VGE_GravshipArmor', 'VGE_IndustrialOxygenPump') or 'Airlock' in name or 'VacBarrier' in name:
        row['replacesHull'] = True
    if name in ('VGE_GravshipStructuralBeam', 'VGE_GravshipArmor', 'VGE_IndustrialOxygenPump'):
        row['hullLike'] = True
    if 'VacBarrier' in name or 'Airlock' in name:
        row['barrier'] = True
    if 'GravjumperEngine' in name or 'GravhulkEngine' in name:
        row['rotate'] = False
        engines.append(row)
    else:
        components.append(row)

aliases = {'ChemfuelTank':'small-tank','LargeChemfuelTank':'large-tank','SmallThruster':'small-thruster','LargeThruster':'large-thruster','PilotConsole':'pilot-console','SignalJammer':'signal-jammer','GravcorePowerCell':'power-cell','FuelOptimizer':'fuel-optimizer','GravshipShieldGenerator':'shield-generator','PilotSubpersonaCore':'subpersona-core','OxygenPump':'oxygen-pump','VacBarrier':'vac-barrier','GravEngine':'engine','GravFieldExtender':'extender'}
overrides = {1:{}, 2:{}}
for chapter in (1,2):
    for file in sorted((SOURCES / f'chapter{chapter}' / '1.6/Patches').glob('*.xml')):
        for operation in ET.parse(file).getroot().iter():
            xpath = text(operation, 'xpath')
            match = re.match(r'Defs/ThingDef\[defName="([^"]+)"\]', xpath)
            value = operation.find('value')
            if not match or match[1] not in aliases or value is None:
                continue
            patch = overrides[chapter].setdefault(aliases[match[1]], {})
            before_patch = copy.deepcopy(patch)
            if systems := system_properties(value):
                patch.setdefault('systems',{}).update(systems)
            if specs := specifications(value):
                patch.setdefault('specs',{}).update(specs)
            leaf = xpath.split('/')[-1] if not xpath.endswith('/text()') else xpath.split('/')[-2]
            for tag,prop in [('GravshipRange','range'),('fuelSavingsPercent','fuelSavings'),('passiveHeatGeneration','activeShieldHeatPerHour')]:
                if leaf == tag:
                    amount = float((value.text or '').strip())
                    patch.setdefault('systems',{})[prop] = amount*10 if tag=='passiveHeatGeneration' else amount
            for tag, prop in [('label','name'),('description','note'),('maxSimultaneous','limit'),('radius','fieldRadius'),('rotatable','rotate')]:
                found = value.find(tag)
                content = (found.text or '') if found is not None else (value.text or '').strip() if leaf == tag else ''
                if content:
                    patch[prop] = int(content) if prop == 'limit' else float(content) if prop == 'fieldRadius' else content.lower() == 'true' if prop == 'rotate' else initial_cap(content.replace('\\n','\n')) if prop == 'name' else content.replace('\\n','\n')
            if '/graphicData/texPath' in xpath:
                path = text(value, 'texPath') or (value.text or '').strip()
                sprites = {direction: found for direction in ('south','east','north','west') if (found := sprite(chapter, path + '_' + direction))}
                if single := sprite(chapter, path):
                    sprites.setdefault('south',single)
                if sprites:
                    patch['sprites'] = sprites
            if '/graphicData/drawSize' in xpath:
                dimensions = pair(text(value,'drawSize') or (value.text or '').strip())
                patch['drawSize'] = dimensions * 2 if len(dimensions) == 1 else dimensions
            if '/building/doorTopGraphic/texPath' in xpath:
                path = (value.text or '').strip()
                top_sprites = {direction: found for direction in ('south','east','north','west') if (found := sprite(chapter,path+'_'+direction))}
                if top_sprites:
                    patch['topSprites'] = top_sprites
            modifier = value.find('.//VGE_SubstructureSupportMultiplier')
            if modifier is not None:
                patch['supportMultiplier'] = float(modifier.text)
            for comp in value.findall('.//li'):
                if 'Gravship' in comp.get('Class','') and comp.find('maxSimultaneous') is not None:
                    patch['limit'] = int(text(comp,'maxSimultaneous'))
            if match[1] == 'GravEngine' and leaf == 'SubstructureSupport':
                patch['support'] = int((value.text or '').strip())
            support = value.find('SubstructureSupport')
            if support is not None:
                patch['supportOffset'] = int(support.text)
            if value.find('passiveHeatGeneration') is not None:
                patch.setdefault('systems',{})['activeShieldHeatPerHour'] = float(text(value,'passiveHeatGeneration'))*10
            if patch != before_patch:
                patch['source'] = f'https://github.com/Vanilla-Expanded/{REPOS[chapter]}/blob/{commits[chapter]}/{file.relative_to(SOURCES / f"chapter{chapter}").as_posix()}'

for patches in overrides.values():
    for patch in patches.values():
        if patch.get('limit',0) >= 9999:
            patch.pop('limit')
for thruster in ('small-thruster','large-thruster'):
    overrides[1][thruster]['exhaustFacing'] = 'rotation'
sprite(1,'UI/MenuIcons/Subscaffold_MenuIcon')
sprite(1,'Things/Terrain/Substructure/Subscaffolding')
payload = '// Generated by tools/import-mods.py. See MOD_SUPPORT.md for provenance.\n'
payload += 'export const MOD_COMPONENTS = ' + json.dumps(components, indent=2, ensure_ascii=False) + ';\n'
payload += 'export const MOD_ENGINES = ' + json.dumps(engines, indent=2, ensure_ascii=False) + ';\n'
payload += 'export const MOD_OVERRIDES = ' + json.dumps(overrides, indent=2, ensure_ascii=False) + ';\n'
heat_source = (SOURCES/'chapter1/Source/Comps/CompHeatManager.cs').read_text(encoding='utf8')
system_rules = {key:float(re.search(r'const float '+name+r' = ([\d.]+)f',heat_source)[1]) for key,name in [('heatMultiplier','BaseHeatMultiplier'),('heatCapacityMultiplier','BaseHeatsinkCapacityMultiplier'),('fuelToHeatFactor','BaseFuelToHeatFactor')]}
system_rules['astrofuelPerRange'] = float(ET.parse(SOURCES/'chapter1/1.6/Defs/NetDefs/AstrofuelNet.xml').findtext('.//resourceToRangeRatio'))
payload += 'export const MOD_SYSTEM_RULES = '+json.dumps(system_rules,indent=2)+';\n'
(ROOT / 'mod-data.js').write_text(payload, encoding='utf-8', newline='\n')
manifest = dict(repositories={str(ch): dict(repository=REPOS[ch], commit=commits[ch], definitions='1.6') for ch in (1,2)}, artwork=artwork,
                artworkHashes={path:hashlib.sha256((ROOT/'assets'/path).read_bytes()).hexdigest() for path in artwork})
(ROOT / 'assets/mods/sources.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
# Drop files imported by an earlier snapshot that are no longer referenced.
art_root = (ROOT / 'assets/mods').resolve()
for old in art_root.rglob('*.png'):
    if old.relative_to(ROOT / 'assets').as_posix() not in artwork:
        if not old.resolve().is_relative_to(art_root):
            raise ValueError('Artwork cleanup escaped assets/mods')
        old.unlink()
reference = ['# Imported mod component catalog', '', 'Generated by `python tools/import-mods.py`. See [mod support](MOD_SUPPORT.md) for rules and scope.', '']
for chapter in (1,2):
    reference += [f'## Chapter {chapter}', '', '| Component | Footprint | Rotates | Ship limit |', '| --- | --- | --- | --- |']
    for c in components:
        if c['chapter'] == chapter:
            reference.append(f'| [{c["name"]}]({c["source"]})'+(f' ({c["requiresDlc"]})' if c.get('requiresDlc') else '')+f' | {c["width"]} × {c["height"]} | {"Yes" if c["rotate"] else "No"} | {c.get("limit", "—")} |')
    reference += ['']
(ROOT/'MOD_CATALOG.md').write_text('\n'.join(reference), encoding='utf-8', newline='\n')
print(f'Imported {len(components)} components, {len(engines)} engines and {len(artwork)} original artwork files.')
