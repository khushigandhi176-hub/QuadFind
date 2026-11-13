import { useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Backpack,
  BookOpen,
  CheckCircle2,
  CupSoda,
  Glasses,
  KeyRound,
  Laptop,
  PackageCheck,
} from 'lucide-react';
import type { ItemCategory, LostFoundItem } from '../types';
import { resolveItemImage } from '../lib/itemImages';
import { formatRelativeTime } from '../lib/constants';

interface ItemCardProps {
  item: LostFoundItem;
  onSelect: (item: LostFoundItem) => void;
}

function CategoryFallbackIcon({ category }: { category: ItemCategory }) {
  const iconClass = 'w-9 h-9 text-slate-400';
  switch (category) {
    case 'Electronics':
      return <Laptop className={iconClass} strokeWidth={1.5} />;
    case 'Keys & IDs':
      return <KeyRound className={iconClass} strokeWidth={1.5} />;
    case 'Books & Notes':
      return <BookOpen className={iconClass} strokeWidth={1.5} />;
    case 'Bottles & Gear':
      return <CupSoda className={iconClass} strokeWidth={1.5} />;
    case 'Eyewear & Accessories':
      return <Glasses className={iconClass} strokeWidth={1.5} />;
    case 'Bags & Apparel':
      return <Backpack className={iconClass} strokeWidth={1.5} />;
  }
}

export function StatusIndicator({ item }: { item: LostFoundItem }) {
  if (item.status === 'returned') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
        <PackageCheck className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
        <span>Returned</span>
      </span>
    );
  }

  if (item.type === 'found') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
        <span>{item.status === 'claimed' ? 'Found · Claim Pending' : 'Found'}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
      <AlertCircle className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
      <span>{item.status === 'claimed' ? 'Lost · Sighting Reported' : 'Lost'}</span>
    </span>
  );
}

export function ItemCard({ item, onSelect }: ItemCardProps) {
  const [imageError, setImageError] = useState(false);
  const imageSrc = !imageError ? resolveItemImage(item) : null;

  return (
    <article className="group flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden transition-all duration-150 hover:border-slate-300 hover:-translate-y-0.5 hover:shadow-sm">
      <button
        type="button"
        onClick={() => onSelect(item)}
        className="flex flex-col flex-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 cursor-pointer"
      >
        <div className="relative w-full aspect-[4/3] bg-slate-100 overflow-hidden border-b border-slate-100">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={item.title}
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-100 to-slate-200/70 px-6 text-center">
              <CategoryFallbackIcon category={item.category} />
              <span className="text-xs font-medium text-slate-500">{item.category}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col flex-1 p-5">
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500">
            <StatusIndicator item={item} />
            <span aria-hidden="true">·</span>
            <span>{item.category}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate max-w-[140px]">{item.building}</span>
          </div>

          <h3 className="mt-2 text-base font-semibold text-slate-900 leading-snug line-clamp-1 group-hover:text-blue-700 transition-colors">
            {item.title}
          </h3>

          <p className="mt-1.5 text-sm text-slate-600 leading-relaxed line-clamp-2 flex-1">
            {item.description}
          </p>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-2 font-mono tabular-nums">
              <span>{item.caseNumber}</span>
              <span aria-hidden="true">·</span>
              <span>{formatRelativeTime(item.createdAt)}</span>
            </div>

            <span className="inline-flex items-center gap-1 font-medium text-blue-700 whitespace-nowrap shrink-0">
              {item.status === 'returned'
                ? 'View record'
                : item.type === 'found'
                  ? 'Inspect & Claim'
                  : 'Report Sighting'}
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          </div>
        </div>
      </button>
    </article>
  );
}
