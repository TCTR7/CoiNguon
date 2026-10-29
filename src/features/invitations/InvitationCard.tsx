import { Leaf, MapPin, Clock, CalendarDays } from 'lucide-react';
import type { PublicCard } from './types';
export function InvitationCard({ card, main = false }: { card: PublicCard; main?: boolean }) {
  const Heading = main ? 'h1' : 'h4';
  const date = card.date.split('-').reverse().join('/');
  return (
    <article className="family-invitation" aria-label="Nội dung thiệp mời">
      <div className="invitation-crest" aria-hidden="true">
        <Leaf size={30} />
      </div>
      <p className="eyebrow">MỘT NGÀY VỀ CÙNG NGƯỜI THÂN</p>
      <Heading>{card.title}</Heading>
      {card.message && <p className="invitation-message">{card.message}</p>}
      <dl className="invitation-facts">
        <div>
          <dt>
            <CalendarDays size={20} /> Ngày tổ chức
          </dt>
          <dd>
            {date} <span>(dương lịch)</span>
          </dd>
        </div>
        <div>
          <dt>
            <Clock size={20} /> Giờ tổ chức
          </dt>
          <dd>
            {card.time} · {card.timeZone}
          </dd>
        </div>
        <div>
          <dt>
            <MapPin size={20} /> Địa điểm
          </dt>
          <dd>{card.address}</dd>
        </div>
      </dl>
      {card.contact && <p className="invitation-contact">Liên hệ: {card.contact}</p>}
    </article>
  );
}
