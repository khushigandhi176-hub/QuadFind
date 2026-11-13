import heroCampusDesk from '../assets/images/hero_campus_desk_1794582336004.jpg';
import itemHeadphones from '../assets/images/item_headphones_1794582337076.jpg';
import itemWaterBottle from '../assets/images/item_water_bottle_1794582336847.jpg';
import itemCalculatorNotebook from '../assets/images/item_calculator_notebook_1794582336591.jpg';
import itemKeysLanyard from '../assets/images/item_keys_lanyard_1794582337679.jpg';
import itemGlassesCase from '../assets/images/item_glasses_case_1794582338840.jpg';

export const HERO_CAMPUS_DESK_IMAGE = heroCampusDesk;

export const ITEM_IMAGE_MAP: Record<string, string> = {
  headphones: itemHeadphones,
  water_bottle: itemWaterBottle,
  calculator: itemCalculatorNotebook,
  keys: itemKeysLanyard,
  glasses: itemGlassesCase,
};

export function resolveItemImage(item: {
  imageUrl?: string;
  imageDataUrl?: string;
  imageKey?: string;
}): string | null {
  if (item.imageUrl && (item.imageUrl.startsWith('/api/uploads/') || item.imageUrl.startsWith('http'))) {
    return item.imageUrl;
  }
  if (item.imageDataUrl && item.imageDataUrl.startsWith('data:image/')) {
    return item.imageDataUrl;
  }
  if (item.imageKey && ITEM_IMAGE_MAP[item.imageKey]) {
    return ITEM_IMAGE_MAP[item.imageKey];
  }
  return null;
}
