import test from 'node:test';
import assert from 'node:assert/strict';
import {shipSystems} from './systems.js';
import {normalizeScenario,DEFAULT_SCENARIO} from './scenario.js';
import {blank,sanitize,validate,capacity} from './model.js';

const item=(type,x=5,y=5,rotation=0)=>({type,x,y,rotation});
const design=(components=[],scenario={},modded=false)=>({...blank(),engine:{x:0,y:0},floor:[],components,scenario,...(modded?{mods:{chapter1:true,chapter2:true},engineType:'VGE_GravhulkEngine'}:{})});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);

test('electricity totals vanilla sources without counting generator fuel as flight storage',()=>{
  const s=design(['wood-fired-generator','chemfuel-generator','wind-turbine','geothermal-generator','watermill-generator','vanometric-power-cell','power-cell','solar-generator'].map((type,i)=>item(type,i*9,5)));
  const r=shipSystems(s);assert.equal(r.electricity.totalWatts,12900);assert.equal(r.electricity.engineWatts,0);
  assert.equal(r.electricity.steadyWatts,8900);assert.equal(r.electricity.solarWatts,1700);assert.equal(r.electricity.windWatts,2300);
  assert.equal(r.flight.fuelCapacity,0);assert.equal(r.flight.generatorFuelPerDay,0);
  s.engine=null;assert.equal(shipSystems(s).electricity.totalWatts,12900);
});

test('mod engine generation follows engine size, connected substructure and expanded capacity',()=>{
  const s=design([],{},true);s.engineType='standard';
  for(let y=-4;y<=4;y++)for(let x=-6;x<=6;x++)s.floor.push(`${x},${y}`);
  for(let x=-3;x<=4;x++)s.floor.push(`${x},5`);
  assert.equal(s.floor.length,125);assert.equal(shipSystems(s).electricity.engineWatts,2400);
  s.floor.push('99,99');assert.equal(shipSystems(s).electricity.connectedTiles,125);assert.equal(shipSystems(s).electricity.engineWatts,2400);
  s.extenders=[{x:6,y:0}];near(shipSystems(s).electricity.engineWatts,4800*(1-125/capacity(s)));
  for(const [type,base] of [['standard',4800],['VGE_GravjumperEngine',2400],['VGE_GravhulkEngine',7200]]){
    s.engineType=type;s.floor=[];s.extenders=[];assert.equal(shipSystems(s).electricity.engineWatts,base);
  }
  s.engineType='VGE_GravjumperEngine';s.floor=[];for(let y=-5;y<=5;y++)for(let x=-5;x<=5;x++)s.floor.push(`${x},${y}`);
  assert.equal(shipSystems(s).electricity.engineWatts,0,'over-capacity layouts never generate negative power');
  s.engine=null;assert.equal(shipSystems(s).electricity.engineWatts,0);
});

test('mod electricity applies adjacency and excludes disabled chapters and emergency output',()=>{
  const s=design([item('power-cell',5,5),item('power-cell',6,6),item('VGE_GravshipCapacitor',10,10)],{},true);
  let p=shipSystems(s).electricity;assert.equal(p.steadyWatts,2300);assert.equal(p.adjacencyWatts,300);
  s.components[1].x=7;p=shipSystems(s).electricity;assert.equal(p.steadyWatts,2000);assert.equal(p.adjacencyWatts,0);
  s.components=[item('VGE_GravcorePowerCoil',5,5),item('power-cell',8,6),item('VGE_AstrofuelGenerator',-8,5),item('VGE_IndustrialAstrofuelGenerator',-12,5),item('VGE_EmergencyGenerator',15,5),item('VGE_SolarPanelling',20,5)];
  p=shipSystems(s).electricity;assert.equal(p.steadyWatts,12300);assert.equal(p.adjacencyWatts,900);assert.equal(p.solarWatts,200);assert.equal(p.emergencyGenerators,1);assert.equal(p.totalWatts,19700);
  s.mods={};p=shipSystems(s).electricity;assert.equal(p.totalWatts,1200);assert.equal(p.emergencyGenerators,0);
});

test('heatsink electricity uses the stored heat and research assumptions',()=>{
  const s=design([item('VGE_SmallHeatsink'),item('VGE_LargeHeatsink',10,5)],{},true);
  assert.equal(shipSystems(s).electricity.heatWatts,0);
  s.scenario.heatPercent=50;assert.equal(shipSystems(s).electricity.heatWatts,150);
  s.scenario.heatResearch=true;assert.equal(shipSystems(s).electricity.heatWatts,300);
  s.scenario.heatPercent=0;assert.equal(shipSystems(s).electricity.heatWatts,0);
});

test('vanilla range is capped by thrust and fuel, including optimizer savings and launch minimums',()=>{
  const full=design([
    ...Array.from({length:4},(_,i)=>item('small-thruster',-22+i*3,5)),
    ...Array.from({length:6},(_,i)=>item('large-thruster',5+i*3,10)),
    item('large-tank',-8,8),item('large-tank',-8,12),
  ],{distance:136});
  let r=shipSystems(full);assert.equal(r.flight.thrustCeiling,136);assert.equal(r.flight.range,136);assert.equal(r.jump.fuelSpent,1360);
  full.components.push(item('fuel-optimizer',0,14),item('fuel-optimizer',3,14));r=shipSystems(full);
  assert.equal(r.flight.fuelSavings,.6);assert.equal(r.flight.range,136);near(r.jump.fuelSpent,544);
  const small=design([item('small-thruster'),item('small-tank',8,5),item('fuel-optimizer'),item('fuel-optimizer')],{distance:1,fuelPercent:20});
  r=shipSystems(small);assert.equal(r.flight.range,10);assert.equal(r.jump.fuelSpent,50);
  small.scenario.fuelPercent=19.99;r=shipSystems(small);assert.equal(r.flight.range,0);assert.equal(r.jump.reachable,false);assert.equal(r.jump.fuelSpent,null);
  small.scenario.fuelPercent=0;assert.equal(shipSystems(small).flight.range,0);
});

test('mod range uses astrofuel provider budgets, the correct ranges, and fuel optimizers',()=>{
  const s=design([item('small-thruster'),item('large-thruster',8,5),item('small-tank',12,5),item('fuel-optimizer'),item('fuel-optimizer')],{distance:10,fuelPercent:20},true);
  const r=shipSystems(s);
  assert.equal(r.flight.fuelKind,'Astrofuel');assert.equal(r.flight.gasCeiling,16);assert.equal(r.flight.range,14);assert.equal(r.flight.fullRange,16);
  near(r.flight.fuelPerTile,3.5);near(r.jump.fuelSpent,35);near(r.heat.jumpHeat,7);
  s.components.push(item('VGE_GiantThruster',15,5));assert.equal(shipSystems(s).flight.thrustCeiling,36);
  s.components.push(item('fuel-optimizer'),item('fuel-optimizer'),item('fuel-optimizer'));
  near(shipSystems(s).flight.fuelSavings,.6,'only four optimizers affect the estimate');
});

test('mixed electric/astrofuel flight distributes consumption by provider range, and needs full charge',()=>{
  const s=design([item('small-thruster'),item('small-tank',8,5),item('VGE_SmallElectricThruster',12,5)],{distance:10},true);
  let r=shipSystems(s);assert.equal(r.flight.range,12);assert.equal(r.flight.energyAvailable,2600);
  near(r.jump.fuelSpent,25);near(r.jump.energySpent,2600*10/12);near(r.jump.chargeSpentPercent,100*10/12);assert.equal(r.heat.jumpHeat,10);
  s.scenario.chargePercent=99;r=shipSystems(s);assert.equal(r.flight.range,6);assert.equal(r.flight.fullRange,12);
  s.components.push(item('fuel-optimizer'),item('fuel-optimizer'),item('fuel-optimizer'),item('fuel-optimizer'));
  assert.equal(shipSystems(s).flight.range,6,'uncharged electric thrusters do not expand the usable thrust cap');
  s.components=s.components.filter(c=>c.type==='VGE_SmallElectricThruster');s.scenario={distance:6};r=shipSystems(s);
  assert.equal(r.flight.range,6);assert.equal(r.jump.fuelSpent,0);assert.equal(r.jump.energySpent,2600);
  s.scenario.chargePercent=0;r=shipSystems(s);assert.equal(r.flight.range,0);assert.equal(r.flight.fullRange,6);
});

test('blocked thrusters and disabled mod components cannot inflate range',()=>{
  const s=design([item('small-thruster'),item('VGE_SmallElectricThruster',8,5),item('small-tank',12,5)],{},true);
  s.floor=['5,7'];let r=shipSystems(s);assert.equal(r.flight.blockedThrusters,1);assert.equal(r.flight.range,6);
  s.mods={chapter1:false,chapter2:false};r=shipSystems(s);assert.equal(r.flight.installedThrusters,1);assert.equal(r.flight.gasCeiling,10);assert.equal(r.flight.range,10);
  s.engine=null;assert.equal(shipSystems(s).flight.range,0);
});

test('oxygen tracks storage, crew balance, algae inputs and environment-dependent harvesters',()=>{
  const s=design([item('VGE_SmallOxygenTank'),item('VGE_LargeOxygenTank'),item('VGE_LifeSupportSystem'),item('VGE_OxygenHarvester'),item('oxygen-pump')],{},true);
  let r=shipSystems(s);assert.equal(r.oxygen.capacity,1700);assert.equal(r.oxygen.productionPerDay,80);assert.equal(r.oxygen.oxyalgaePerDay,80);
  assert.equal(r.oxygen.demandPerDay,80);assert.equal(r.oxygen.reserveDays,Infinity);near(r.oxygen.pumpDuty,.08);
  s.scenario={crew:6,oxygenPercent:50};r=shipSystems(s);assert.equal(r.oxygen.loaded,850);assert.equal(r.oxygen.netPerDay,-40);near(r.oxygen.reserveDays,21.25);
  s.scenario.vacuum=false;r=shipSystems(s);assert.equal(r.oxygen.productionPerDay,320);assert.equal(r.oxygen.demandPerDay,0);
  s.components.push(item('VGE_OxygenReclaimer'));assert.equal(shipSystems(s).oxygen.productionPerDay,350);
  s.mods={};r=shipSystems(s);assert.equal(r.oxygen.capacity,0);assert.equal(r.oxygen.demandPerDay,0);assert.equal(r.oxygen.pumps,1);
});

test('cabin refill scales with volume and pump type without charging peak pump flow as crew consumption',()=>{
  const s=design([item('oxygen-pump')],{cabinTiles:100},true);
  let r=shipSystems(s);assert.equal(r.oxygen.fillOxygen,100);assert.equal(r.oxygen.fillSeconds,100);assert.equal(r.oxygen.demandPerDay,80);
  s.components.push(item('VGE_IndustrialOxygenPump'));r=shipSystems(s);near(r.oxygen.fillSeconds,100/6);near(r.oxygen.pumpPerSecond,6);
  s.components=[];r=shipSystems(s);assert.equal(r.oxygen.fillSeconds,Infinity);assert.equal(r.oxygen.pumpDuty,Infinity);
  s.floor=['0,0','1,0'];s.scenario={};assert.equal(shipSystems(s).oxygen.cabinTiles,2);
  s.scenario={cabinTiles:0,crew:0};r=shipSystems(s);assert.equal(r.oxygen.fillSeconds,0);assert.equal(r.oxygen.reserveDays,Infinity);
});

test('heatsinks use displayed heat units, research multipliers, stored load and passive cooling',()=>{
  const s=design([item('VGE_SmallHeatsink'),item('VGE_LargeHeatsink'),item('small-thruster'),item('small-tank')],{distance:10,heatPercent:50},true);
  let r=shipSystems(s);assert.equal(r.heat.capacity,120);assert.equal(r.heat.stored,60);assert.equal(r.heat.jumpHeat,10);assert.equal(r.heat.safeJumps,6);
  assert.equal(r.heat.dissipationPerHour,3);near(r.heat.clearHours,70/3);near(r.heat.cooldownReduction,.07);
  s.scenario.heatResearch=true;r=shipSystems(s);assert.equal(r.heat.capacity,240);assert.equal(r.heat.stored,120);assert.equal(r.heat.safeJumps,12);
  s.scenario.heatPercent=100;r=shipSystems(s);assert.equal(r.heat.overflow,10);assert.equal(r.heat.safeJumps,0);assert.equal(r.heat.absorbed,0);
  s.components.push(item('VGE_GravheatAbsorber'));r=shipSystems(s);assert.equal(r.heat.absorbers,1);assert.equal(r.heat.overflow,10,'manual absorbers do not silently erase heat');
});

test('heat handles minimum launches, no sinks, shields and capped cooldown bonuses',()=>{
  const s=design([item('small-thruster'),item('small-tank',8,5),item('shield-generator',-8,5),item('VGE_LargeGravshipShieldGenerator',12,5)],{distance:1},true);
  let r=shipSystems(s);assert.equal(r.jump.fuelSpent,25);assert.equal(r.heat.jumpHeat,5);assert.equal(r.heat.capacity,0);assert.equal(r.heat.overflow,5);
  assert.equal(r.heat.activeShieldHeatPerHour,40);assert.equal(r.heat.safeJumps,0);
  s.components.push(...Array.from({length:20},()=>item('VGE_SmallHeatsink')),...Array.from({length:20},()=>item('VGE_LargeHeatsink')));
  r=shipSystems(s);assert.equal(r.heat.capacity,10*20+6*100);near(r.heat.cooldownReduction,.5);
  s.mods={};r=shipSystems(s);assert.equal(r.heat.jumpHeat,0);assert.equal(r.heat.capacity,0);
});

test('refining production honors adjacent astropurifiers and keeps generator refill demand separate',()=>{
  const s=design([item('VGE_AstrofuelSynthesizer',5,5),item('VGE_AstrofuelGenerator',-8,5)],{},true);
  let r=shipSystems(s);assert.equal(r.flight.fuelProductionPerDay,400);assert.equal(r.flight.refiningChemfuelPerDay,800);assert.equal(r.flight.generatorFuelPerDay,3);
  s.components.push(item('VGE_Astropurifier',9,5));r=shipSystems(s);assert.equal(r.flight.fuelProductionPerDay,200);assert.equal(r.flight.refiningChemfuelPerDay,200);
  s.components.at(-1).x=10;r=shipSystems(s);assert.equal(r.flight.fuelProductionPerDay,400);
});

test('assumptions sanitize safely, survive saves and leave legacy designs unchanged',()=>{
  assert.deepEqual(normalizeScenario(),DEFAULT_SCENARIO);
  const bad=normalizeScenario({crew:-1,distance:Infinity,fuelPercent:120,oxygenPercent:NaN,chargePercent:99,heatPercent:-10,cabinTiles:50001,vacuum:false,heatResearch:true});
  assert.deepEqual(bad,{...DEFAULT_SCENARIO,crew:0,fuelPercent:100,chargePercent:99,heatPercent:0,cabinTiles:50000,vacuum:false,heatResearch:true});
  const s=design([],{crew:7,fuelPercent:25,cabinTiles:250},true),r=sanitize(JSON.parse(JSON.stringify(s)));
  assert.equal(r.scenario.crew,7);assert.equal(r.scenario.fuelPercent,25);assert.equal(r.scenario.cabinTiles,250);
  assert.deepEqual(sanitize(blank()),blank());assert.deepEqual(blank({scenario:r.scenario}).scenario,r.scenario);
  const copy=structuredClone(s),validation=validate(s);shipSystems(s,validation);assert.deepEqual(s,copy,'systems calculation is read-only');
});
