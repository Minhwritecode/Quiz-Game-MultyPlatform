import type { Model3DType } from './Model3DView';

const modelCache = new Map<Model3DType, string>();

/**
 * Lazy loads 3D model base64 data on demand.
 * Prevents the 4.9MB 3D assets from bloating the initial app bundle.
 * Caches loaded models in-memory so subsequent views render instantly without reloading.
 */
export async function loadModelDataUri(model: Model3DType): Promise<string> {
  const cached = modelCache.get(model);
  if (cached) return cached;

  let uri = '';
  switch (model) {
    case 'character': {
      const mod = require('./models3d/character');
      uri = mod.GLB_PAPYRUS_CHARACTER_B64;
      break;
    }
    case 'survival': {
      const mod = require('./models3d/survival');
      uri = mod.GLB_SURVIVAL_ARENA_B64;
      break;
    }
    case 'battle': {
      const mod = require('./models3d/colosseum');
      uri = mod.GLB_BATTLE_COLOSSEUM_B64;
      break;
    }
    case 'match': {
      const mod = require('./models3d/library');
      uri = mod.GLB_LIBRARY_ARCHIVES_B64;
      break;
    }
    case 'questEmblem': {
      const mod = require('./models3d/questEmblem');
      uri = mod.GLB_QUEST_EMBLEM_B64;
      break;
    }
    case 'splashMorph': {
      const mod = require('./models3d/splashMorph');
      uri = mod.GLB_SPLASH_MORPH_B64;
      break;
    }
    case 'study':
    default: {
      const mod = require('./models3d/sanctuary');
      uri = mod.GLB_STUDY_SANCTUARY_B64;
      break;
    }
  }

  modelCache.set(model, uri);
  return uri;
}
