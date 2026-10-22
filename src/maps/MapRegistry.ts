import { BuiltMapData, MapEnvironmentConfig, MapId } from '../types/contracts';
import { MaterialLibrary } from '../rendering/MaterialLibrary';
import { buildBreakwaterTerminal } from './BreakwaterTerminal';
import { buildMesaRelay } from './MesaRelay';
import { buildNorthstarFacility } from './NorthstarFacility';

export const MAP_IDS: MapId[] = ['breakwater', 'mesa', 'northstar'];

export function buildMapById(mapId: MapId, materials: MaterialLibrary): BuiltMapData {
  switch (mapId) {
    case 'breakwater':
      return buildBreakwaterTerminal(materials);
    case 'mesa':
      return buildMesaRelay(materials);
    case 'northstar':
      return buildNorthstarFacility(materials);
  }
}

export const MAP_SUMMARIES: Record<MapId, {
  id: MapId;
  name: string;
  subtitle: string;
  locationLabel: string;
  timeOfDayLabel: string;
  tacticalBrief: string;
  previewAccentColor: string;
}> = {
  breakwater: {
    id: 'breakwater',
    name: 'BREAKWATER TERMINAL',
    subtitle: 'COASTAL FREIGHT INTERDICTION',
    locationLabel: 'SECTOR 04 // NORTH SEA PORT',
    timeOfDayLabel: '05:42 LOCAL // BLUE HOUR POST-RAIN',
    tacticalBrief:
      'Wet concrete dockside cargo lanes, a central gantry crane loading yard, and a sheltered maintenance warehouse linked by an elevated service catwalk.',
    previewAccentColor: '#38bdf8',
  },
  mesa: {
    id: 'mesa',
    name: 'MESA RELAY',
    subtitle: 'ARID DEEP-SPACE ARRAY',
    locationLabel: 'SECTOR 09 // SONORAN BADLANDS',
    timeOfDayLabel: '14:15 LOCAL // HIGH SOLAR CLEAR',
    tacticalBrief:
      'Sunlit sandstone cliffs frame a central parabolic dish courtyard, flanked by twin signal-processing buildings, a rock-cut canyon pass, and a north ridge overlook.',
    previewAccentColor: '#f59e0b',
  },
  northstar: {
    id: 'northstar',
    name: 'NORTHSTAR FACILITY',
    subtitle: 'ARCTIC CRYO-LOGISTICS COMPLEX',
    locationLabel: 'SECTOR 12 // SVALBARD RIDGE',
    timeOfDayLabel: '18:10 LOCAL // POLAR TWILIGHT',
    tacticalBrief:
      'Snow-drifted service yards and a heated elevated skybridge connect a warm, occupied cryo-research laboratory with a tight industrial HVAC maintenance passage.',
    previewAccentColor: '#67e8f9',
  },
};
