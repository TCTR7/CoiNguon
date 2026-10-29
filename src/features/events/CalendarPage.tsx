import { ArrowRight, CalendarDays, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { demoEvent } from '../../shared/data/demo';
export default function CalendarPage() {
  return (
    <section>
      <p className="eyebrow">DÀNH MỘT NGÀY ĐỂ NHỚ</p>
      <h1>Lịch giỗ gia đình</h1>
      <p className="page-intro">Cùng chuẩn bị, cùng sum họp, cùng gìn giữ nếp nhà.</p>
      <div className="calendar-month">
        <h2>
          Tháng 11 <span>2026</span>
        </h2>
        <span className="tag green">
          <CalendarDays size={16} /> 1 sự kiện mẫu
        </span>
      </div>
      <article className="event-feature calendar-event">
        <div className="event-content">
          <div className="date-tile">
            <span>THÁNG 11</span>
            <strong>08</strong>
            <span>CHỦ NHẬT</span>
          </div>
          <div>
            <span className="eyebrow">NGÀY TỔ CHỨC MẪU · DƯƠNG LỊCH</span>
            <h2>{demoEvent.title}</h2>
            <p className="icon-text">
              <MapPin size={18} />
              {demoEvent.address}
            </p>
            <p className="subtle">
              {demoEvent.time} · Chủ sự: {demoEvent.host}
            </p>
            <p className="subtle">
              Ngày giỗ âm lịch sẽ hiển thị sau khi quy tắc lịch được xác nhận.
            </p>
          </div>
        </div>
        <div className="event-footer">
          <span>Thiệp mời dành cho gia đình</span>
          <Link className="text-link" to="/thiep-moi">
            Mở thiệp <ArrowRight size={18} />
          </Link>
        </div>
      </article>
    </section>
  );
}
