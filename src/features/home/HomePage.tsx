import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronRight,
  MapPin,
  Sprout,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { HeritageIllustration } from '../../shared/ui/Illustrations';
import { demoEvent, people } from '../../shared/data/demo';
export default function HomePage() {
  return (
    <>
      <section className="welcome">
        <div>
          <p className="eyebrow">
            <span className="small-line" /> MỘT MÁI NHÀ, NHIỀU THẾ HỆ
          </p>
          <h1>
            Gìn giữ cội nguồn.
            <br />
            <em>Tiếp nối yêu thương.</em>
          </h1>
          <p className="welcome-copy">
            Mỗi người là một nhánh, mỗi ký ức là một phần của gia đình. Cùng lưu giữ để những thế hệ
            sau luôn biết đường trở về.
          </p>
          <Link className="button primary" to="/gia-pha">
            <BookOpen size={19} /> Khám phá gia phả <ArrowRight size={18} />
          </Link>
          <div className="family-note">
            <span className="stacked-initials">
              <span>Đ</span>
              <span>K</span>
              <span>M</span>
            </span>
            <span>
              <strong>Gia đình họ Trần</strong>
              <small>Những câu chuyện còn được viết tiếp</small>
            </span>
          </div>
        </div>
        <div className="hero-visual">
          <HeritageIllustration />
          <span className="vertical-caption">CÂY CÓ CỘI · NƯỚC CÓ NGUỒN</span>
          <span className="art-caption">Nơi chúng ta bắt đầu.</span>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">CÙNG NHAU GHI NHỚ</p>
          <h2>Chuyện trong gia đình</h2>
        </div>
        <Link className="text-link" to="/lich-gio">
          Xem lịch giỗ <ArrowRight size={17} />
        </Link>
      </div>
      <div className="home-grid">
        <article className="event-feature">
          <div className="event-topline">
            <span className="tag">
              <CalendarDays size={15} /> Lễ giỗ sắp tới
            </span>
            <span className="subtle">Lịch mẫu</span>
          </div>
          <div className="event-content">
            <div className="date-tile">
              <span>THÁNG 11</span>
              <strong>08</strong>
              <span>CHỦ NHẬT</span>
            </div>
            <div>
              <h3>{demoEvent.title}</h3>
              <p className="muted">Một ngày sum họp, cùng nhớ về ông.</p>
              <p className="icon-text">
                <MapPin size={17} />
                {demoEvent.address}
              </p>
              <p className="subtle">
                Chủ sự: {demoEvent.host} · {demoEvent.time}
              </p>
            </div>
          </div>
          <div className="event-footer">
            <span>Gia đình mình có tham dự không?</span>
            <Link className="text-link" to="/thiep-moi">
              Xem thiệp mời <ArrowRight size={17} />
            </Link>
          </div>
        </article>
        <article className="branch-card">
          <span className="icon-circle">
            <Sprout size={27} />
          </span>
          <h3>
            Từ một gốc rễ,
            <br />
            vươn nhiều nhánh xanh.
          </h3>
          <p>Gặp lại những gương mặt thân quen và tìm hiểu các thế hệ trong gia đình.</p>
          <Link className="text-link" to="/gia-pha">
            Mở cây gia phả <ArrowRight size={17} />
          </Link>
          <span className="branch-watermark" aria-hidden="true">
            ❧
          </span>
        </article>
      </div>
      <section className="family-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">NHỮNG NGƯỜI THÂN YÊU</p>
            <h2>Mỗi người, một câu chuyện</h2>
          </div>
          <Link className="text-link" to="/gia-pha">
            Xem tất cả <ArrowRight size={17} />
          </Link>
        </div>
        <div className="people-preview">
          {people.slice(0, 4).map((person, i) => (
            <Link to={'/gia-pha/' + person.id} className="person-preview" key={person.id}>
              <span className={'avatar tone-' + i}>{person.initials}</span>
              <span>
                <strong>{person.name}</strong>
                <small>
                  {person.generation} · {person.role}
                </small>
              </span>
              <ChevronRight size={18} />
            </Link>
          ))}
        </div>
      </section>
      <div className="closing-note">
        <Users size={18} />
        <span>Gia phả được gìn giữ từ những điều nhỏ, bởi tất cả chúng ta.</span>
      </div>
    </>
  );
}
