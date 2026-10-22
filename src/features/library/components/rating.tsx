import { Star, StarHalf } from "lucide-react";
import { useI18n } from "../../i18n/i18n-context";
import type { Messages } from "../../i18n/messages";

const steps = [1, 2, 3, 4, 5] as const;

export const ratingLabel = (rating: number | null, t: Messages, locale: string) =>
  rating === null ? t.rating.none : t.rating.value(rating.toLocaleString(locale));

// Come in Bookpedia: un clic dà la stella intera, un secondo clic sulla stessa la dimezza.
export const nextRating = (current: number | null, star: number) =>
  current === star ? star - 0.5 : star;

const StarIcon = ({ rating, star, size }: { rating: number; star: number; size: number }) =>
  rating >= star ? (
    <Star size={size} className="fill-current" />
  ) : rating >= star - 0.5 ? (
    <span className="relative inline-flex">
      <Star size={size} className="opacity-35" />
      <StarHalf size={size} className="absolute inset-0 fill-current" />
    </span>
  ) : (
    <Star size={size} className="opacity-35" />
  );

export function Rating({ rating, size = 14 }: { rating: number | null; size?: number }) {
  const { t, locale } = useI18n();
  return (
    <span role="img" aria-label={ratingLabel(rating, t, locale)} className="inline-flex gap-0.5 text-star">
      {steps.map((star) => (
        <StarIcon key={star} rating={rating ?? 0} star={star} size={size} />
      ))}
    </span>
  );
}

export function RatingInput({
  rating,
  onChange,
  size = 18,
}: {
  rating: number | null;
  onChange: (rating: number | null) => void;
  size?: number;
}) {
  const { t, locale } = useI18n();
  return (
    <div className="inline-flex items-center gap-0.5 text-star" role="group" aria-label={ratingLabel(rating, t, locale)}>
      {steps.map((star) => (
        <button
          key={star}
          type="button"
          aria-label={t.rating.stars(star)}
          onClick={() => onChange(nextRating(rating, star))}
          className="rounded p-0.5 hover:bg-chip"
        >
          <StarIcon rating={rating ?? 0} star={star} size={size} />
        </button>
      ))}
      {rating !== null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-1 rounded px-1 text-xs text-muted hover:bg-chip"
        >
          {t.rating.clear}
        </button>
      )}
    </div>
  );
}
