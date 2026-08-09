import { normalizeCharacterIndex } from "./ClassroomSessionService";

export const CHARACTER_SPRITE_COLUMNS: number = 16;
export const CHARACTER_SPRITE_ROWS: number = 16;
export const CHARACTER_SPRITE_COUNT = CHARACTER_SPRITE_COLUMNS * CHARACTER_SPRITE_ROWS;

export function renderCharacterSprite(index: number, className: string): string {
  const characterIndex = normalizeCharacterIndex(index);
  const column = characterIndex % CHARACTER_SPRITE_COLUMNS;
  const row = Math.floor(characterIndex / CHARACTER_SPRITE_COLUMNS);
  return `<span class="character-sprite ${className}" style="${getCharacterSpriteStyle(column, row)}" aria-hidden="true"></span>`;
}

export function setCharacterSprite(element: HTMLElement, index: number): void {
  const characterIndex = wrapCharacterIndex(index);
  const column = characterIndex % CHARACTER_SPRITE_COLUMNS;
  const row = Math.floor(characterIndex / CHARACTER_SPRITE_COLUMNS);
  element.setAttribute("style", getCharacterSpriteStyle(column, row));
}

export function wrapCharacterIndex(index: number): number {
  return Number.isInteger(index)
    ? ((index % CHARACTER_SPRITE_COUNT) + CHARACTER_SPRITE_COUNT) % CHARACTER_SPRITE_COUNT
    : 0;
}

function getCharacterSpriteStyle(column: number, row: number): string {
  const x = CHARACTER_SPRITE_COLUMNS === 1 ? 0 : (column / (CHARACTER_SPRITE_COLUMNS - 1)) * 100;
  const y = CHARACTER_SPRITE_ROWS === 1 ? 0 : (row / (CHARACTER_SPRITE_ROWS - 1)) * 100;
  return `--character-x: ${x}%; --character-y: ${y}%;`;
}
