import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, MapPin } from 'lucide-react';
import { people } from '../../shared/data/demo';
import { Portrait } from '../../shared/ui/Illustrations';
export default function ProfilePage() {
  const { personId } = useParams();
  const person = people.find((p) => p.id === personId);
  if (!person)
    return (
      <section className="empty-state">
        <h1>Không tìm thấy hồ sơ</h1>
        <Link className="button primary" to="/gia-pha">
          Về gia phả
        </Link>
      </section>
    );
  return (
    <>
      <Link className="back-link" to="/gia-pha">
        <ArrowLeft size={18} /> Về gia phả
      </Link>
      <section className="profile-header">
        <div className="portrait-frame">
          <Portrait />
          <span>Hình minh họa</span>
        </div>
        <div>
          <p className="eyebrow">
            {person.generation.toUpperCase()} · {person.branch.toUpperCase()}
          </p>
          <h1>{person.name}</h1>
          <p className="profile-years">{person.years}</p>
          <p className="profile-quote">“Đi xa đến đâu, vẫn nhớ nơi mình bắt đầu.”</p>
          <span className="tag green">
            <BookOpen size={15} /> Hồ sơ gia đình mẫu
          </span>
        </div>
      </section>
      <div className="profile-grid">
        <section className="paper-panel">
          <p className="eyebrow">MỘT CUỘC ĐỜI ĐƯỢC GHI NHỚ</p>
          <h2>Câu chuyện của {person.name}</h2>
          <p>
            {person.id === 'tran-van-an'
              ? 'Ông An là người yêu nếp nhà, quý những bữa cơm sum họp. Trong ký ức con cháu, ông luôn dành thời gian kể chuyện làng, dạy cách chăm vườn và nhắc mọi người giữ gìn tình thân.'
              : 'Những ký ức, câu chuyện và dấu mốc của người thân sẽ được gia đình cùng nhau bổ sung tại đây.'}
          </p>
          <p className="subtle">
            Nội dung minh họa được tạo cho bản dùng thử, không phải dữ liệu gia đình thật.
          </p>
        </section>
        <section className="paper-panel">
          <p className="eyebrow">DẤU MỐC GIA ĐÌNH</p>
          <h2>Thông tin lưu giữ</h2>
          <dl className="facts">
            <div>
              <dt>Thế hệ</dt>
              <dd>{person.generation}</dd>
            </div>
            <div>
              <dt>Nhánh gia đình</dt>
              <dd>{person.branch}</dd>
            </div>
            <div>
              <dt>Ngày sinh / mất</dt>
              <dd>Chưa có ngày tháng đầy đủ</dd>
            </div>
          </dl>
          {person.id === 'tran-van-an' && (
            <Link className="text-link" to="/thiep-moi">
              <CalendarDays size={18} /> Xem lễ giỗ sắp tới <ArrowRight size={17} />
            </Link>
          )}
        </section>
      </div>
      <section className="family-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SỢI DÂY KẾT NỐI</p>
            <h2>Trong gia đình</h2>
          </div>
        </div>
        <div className="people-preview">
          {people
            .filter((p) => p.id !== person.id)
            .slice(0, 3)
            .map((p, i) => (
              <Link className="person-preview" key={p.id} to={'/gia-pha/' + p.id}>
                <span className={'avatar tone-' + i}>{p.initials}</span>
                <span>
                  <strong>{p.name}</strong>
                  <small>{p.generation}</small>
                </span>
                <ArrowRight size={18} />
              </Link>
            ))}
        </div>
      </section>
      <p className="subtle icon-text">
        <MapPin size={16} /> Mộ phần và tài liệu riêng tư chưa được nhập trong bản mẫu.
      </p>
    </>
  );
}
