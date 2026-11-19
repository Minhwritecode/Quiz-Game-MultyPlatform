import { loadModelDataUri } from './modelLoader';

describe('modelLoader', () => {
  it('lazy loads model data uri with caching', async () => {
    const uri1 = await loadModelDataUri('character');
    expect(uri1).toContain('data:model/gltf-binary;base64,');

    const uriCached = await loadModelDataUri('character');
    expect(uriCached).toBe(uri1);
  });

  it('supports study sanctuary model', async () => {
    const uri = await loadModelDataUri('study');
    expect(uri).toContain('data:model/gltf-binary;base64,');
  });
});
