# Ship systems estimates

The inspector's **Ship systems** section updates with the design. **Planning
assumptions** sets crew, requested jump distance, fuel/oxygen fill percentages,
electric charge, initial heatsink load, cabin size, vacuum environment and Heat
Dissipation research. These values are saved with the design and draft, restored
on load and undo, and retained by New. Old designs use the defaults: four crew,
10 surface tiles, full fuel/oxygen/charge, empty heatsinks, vacuum and base
research. Blank cabin size estimates cabin volume from substructure count.

These are planned equipment totals, assuming finished, powered, connected and
supplied equipment. Disabled chapters and components beyond their ship limits
are excluded. Blocked thrusters are excluded from flight estimates because their
clearance is known from the layout. Foundation, connectivity and other build
checks still need to pass; estimates do not inspect actual pipe flow, individual
rooms, roofs, valves, inventory or the world map.

## Electricity

**Estimated generation** adds steady generators, full-sun solar output, normal-wind
output, the selected mod engine's remaining output, and active heatsink generation.
It is generation before consumption, rather than a net power balance or a daily
average. Fuel, suitable river/geyser terrain and working connections are assumed;
roofs, weather and wind clearance are not simulated. Wind turbines use 2,300 W at
normal wind speed; solar generators use 1,700 W at full sunlight.

The vanilla engine generates no electricity. Chapter 1/2 gravjumper, gravship and
gravhulk engines start at 2,400, 4,800 and 7,200 W. Their output follows the mod's
[`CompPowerPlantGravEngine`](https://github.com/Vanilla-Expanded/VanillaGravshipExpanded/blob/7212a0c11bc392079d1f8ac9395d6434aa29b8af/Source/Comps/CompPowerPlantGravEngine.cs):
`base output × max(0, 1 − connected substructure / supported capacity)`.
Disconnected substructure and subscaffold do not consume that power budget.

Mod gravcore cells and coils receive +15% per adjacent linked cell/coil, including
corner adjacency, capped at +120%. The bonus is included in steady generation.
Heatsinks contribute while **Stored heat (%)** is above zero; Heat Dissipation
research doubles their output. This is an initial-output estimate; it falls when
stored heat runs out. Emergency generators follow demand and are excluded from
the total, with a note when one is placed. Batteries and capacitors store energy
and contribute no generation. Disabled chapters and components beyond their
limits are excluded, as for the other system estimates. Numeric mod power data
is imported from the same XML definitions used by the component catalog.

## Fuel and range

Vanilla small/large thrusters provide 10/16 tiles each, capped at four/six. Tanks
hold 250/750 chemfuel. A jump costs `max(50, distance × 10 × fuel factor)`;
optimizers reduce the factor additively by 0.30 each, up to two. The launch minimum
is unchanged. Range is the smaller of fuel-limited range and the thruster ceiling,
rounded down to whole surface world tiles.

The mod's small/large/giant astrofuel thrusters provide 6/10/20 tiles each, capped
at ten/six/four. Storage is imported from each tank definition, including giant
and auxiliary tanks. Each optimizer saves 15%, up to four. The author's fuel
provider computes a base range budget as:

```text
astrofuel budget = min(loaded astrofuel / 5, clear astrofuel-thruster ceiling)
electric budget  = sum(range × charge fraction for charged, clear electric thrusters)
equivalent fuel  = 10 × (astrofuel budget + electric budget)
range            = floor(min(usable thrust ceiling, total budget / fuel factor))
```

Electric thrusters need 100% charge before use. Their energy capacity is imported
from the definitions: 2,600/4,300/8,600 Wd. Undercharged thrusters contribute no
usable range. **Range at full load** fills all tanks and electric batteries while
retaining the design's clearance restrictions.

The mod retains the game's equivalent-fuel launch minimum of 50. For an
astrofuel-only launch this means at least 25 astrofuel, even on a short trip.
Requested jumps consume the same fraction of each contributing provider's range
budget. Mixed flight therefore reports both astrofuel and electric energy usage,
rather than treating electric thrusters as fuel tanks or multiplying all range
by a generic fill percentage. Unreachable jumps are labeled and have no claimed
fuel or charge consumption.

Astrofuel refining shows production and required chemfuel input separately from
generator refill demand. A base synthesizer produces 400 astrofuel/day from 800
chemfuel/day. A side-adjacent astropurifier halves output and quarters chemfuel
use: 200/day of each. This follows the current source implementation. Refining
assumes continuous power and input supply. Generator refill demand is not
silently deducted from a tank's chosen launch load.

The requested distance is a uniform surface-world distance estimate. Actual
terrain path costs, orbital transitions, destination grav anchors, emergency
gravlift launches, rituals and landing outcomes can change the cost. The user
must also satisfy the game's launch prerequisites, including pilot controls.

## Oxygen

With Chapter 1 enabled, the planner totals oxygen storage and production:

| Equipment | Output |
| --- | --- |
| Oxygen harvester | 240/day in breathable atmosphere; zero in vacuum |
| Algae oxygenator | 80/day, requiring 80 oxyalgae/day |
| Oxygen reclaimer | 30/day |

Crew demand assumes standard, body-size-one humanlikes without vacuum-resistant
equipment: 20 units/person/day in vacuum and no stored-oxygen demand in breathable
atmosphere. **Stored-only reserve** divides loaded storage by crew demand;
**Reserve with production** divides storage by the production shortfall. A
non-depleting balance assumes ongoing input supply, including oxyalgae; it is
not an unlimited inventory forecast. Leaks and suit refills add extra demand.

Pump peak flow is for repressurization, not continuous crew consumption. The
small pump can draw 1 unit per 60 ticks; the industrial pump draws 5. Their
pressurization rates are 1%/5% per 100 cabin tiles per 60 ticks. A full refill of
an empty, airtight cabin requires approximately one oxygen unit per tile.
Refill time assumes sufficient oxygen is supplied and all pumps serve the
estimated cabin volume. It is an ideal pump-time estimate, not a room simulation.

Days and hours are in-game: 60,000/2,500 ticks respectively. Production converts
the pipe system's 100-tick rate to 600 intervals/day. Vanilla oxygen pumps do not
use stored oxygen; vanilla mode shows pump count and ideal cabin refill time.

## Heat

Heat uses the same displayed units (**HU**) as the mod's heatsink inspector.
Small/large heatsinks hold 20/100 HU at base research, and cool 1/2 HU per hour.
Heat Dissipation doubles their capacity. Research modifiers are imported from
the actual heatsink comps. Cold-sink launch cooldown reductions are summed and
capped at 50%; this is the maximum bonus before sink saturation.

The source scales internal heat by 100 and heatsink capacity by another factor
of 5. Launch heat starts from equivalent fuel cost divided by 2. In displayed
heatsink units the resulting formula is:

```text
requested jump heat = equivalent fuel cost / (2 × 5)
```

The summary shows initial stored heat, requested jump heat, available capacity,
overflow into rooms, passive sink cooling, approximate sink cooldown and the
number of identical jumps that fit before overflow without cooling between
jumps. Requested-jump heat is shown as a design estimate even if that jump is
currently unreachable. Sink cooldown covers absorbed heat only; room overflow
does not disappear into the sink-cooling estimate.

Active shield background heat is shown separately; incoming weapon damage adds
more. Emergency absorbers are counted but their manual ability is not
automatically activated. Room temperature in Celsius depends on rooms,
insulation, ambient conditions, heating and combat, so no temperature is inferred
from these heat-unit totals. Vanilla mode shows room heater count and explains
that structural heat is a Chapter 1 system.

## Sources and verification

- [Vanilla gravship rules](https://rimworldwiki.com/wiki/Gravship)
- [Vanilla fuel optimizer](https://rimworldwiki.com/wiki/Fuel_optimizer)
- [Chapter 1 fuel providers](https://github.com/Vanilla-Expanded/VanillaGravshipExpanded/blob/7212a0c11bc392079d1f8ac9395d6434aa29b8af/Source/Comps/CompPipeNetGravshipFuelProvider.cs)
- [Provider contract, before applying fuel factor](https://github.com/Vanilla-Expanded/VanillaGravshipExpanded/blob/7212a0c11bc392079d1f8ac9395d6434aa29b8af/Source/IGravshipFuelProvider.cs)
- [Oxygen network definitions](https://github.com/Vanilla-Expanded/VanillaGravshipExpanded/blob/7212a0c11bc392079d1f8ac9395d6434aa29b8af/1.6/Defs/NetDefs/OxygenNet.xml)
- [Heat manager](https://github.com/Vanilla-Expanded/VanillaGravshipExpanded/blob/7212a0c11bc392079d1f8ac9395d6434aa29b8af/Source/Comps/CompHeatManager.cs)
- [Heatsink display and cooling](https://github.com/Vanilla-Expanded/VanillaGravshipExpanded/blob/7212a0c11bc392079d1f8ac9395d6434aa29b8af/Source/Comps/CompHeatsink.cs)
- [Electric provider implementation](https://github.com/Vanilla-Expanded/VanillaGravshipExpanded2/blob/9dcee5bc5c78864dfda60c7b89ce1094b83ef26c/1.7/Source/Comps/CompElectricThruster.cs)

`tools/import-mods.py` extracts numeric component values and global heat/fuel
constants into `mod-data.js`. Formula tests cover vanilla and mod fuel limits,
mixed propulsion, blocked thrusters, minimum launches, oxygen balance, cabin
volume, research, saturation, cooldown, refining adjacency and invalid inputs.
Editor tests cover live updates, saving, loading, undo/redo and cached hover.
