import { describe, expect, it } from 'vitest';
import { parse } from '@/engine/script';
import { HIDESEEK_ADVANCED } from '@/engine/script/presets/hideseekAdvanced';
import { defaultRoom, scriptRooms } from './rooms';

const rooms = (source: string) => scriptRooms(parse(source).program);

describe('rooms a script names', () => {
  it('lists useLayout rooms in the order they are written', () => {
    expect(rooms(HIDESEEK_ADVANCED)).toEqual(['open', 'shelter', 'corridor']);
  });

  it('finds rooms inside ifs and skips unknown ones and repeats', () => {
    const source = `script "t" for hideseek v1
each generation {
  useLayout(id: "shelter")
  if generation > 10 {
    useLayout(id: "corridor")
    useLayout(id: "shelter")
  }
  useLayout(id: "attic")
}
`;
    expect(rooms(source)).toEqual(['shelter', 'corridor']);
  });

  it('starts in the open room when the script names none', () => {
    const none = rooms('script "t" for hideseek v1\neach tick {\n}\n');
    expect(none).toEqual([]);
    expect(defaultRoom(none)).toBe('open');
    expect(defaultRoom(['corridor', 'open'])).toBe('corridor');
  });
});
