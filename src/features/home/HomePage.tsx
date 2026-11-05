import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronRight,
  ShieldCheck,
  Sprout,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { auth } from '../../shared/firebase/client';
import { HeritageIllustration } from '../../shared/ui/Illustrations';

const onboardingSteps = [
  {
    step: '01',
    title: 'Đăng nhập bằng Google',
    detail: 'Tự tạo tài khoản cá nhân và khai số điện thoại để nhận lời mời từ người thân.',
  },
  {
    step: '02',
    title: 'Tạo dòng họ mới hoặc nhận lời mời',
    detail: 'Người lập dòng họ tự động là Quản trị viên; thành viên vào qua lời mời được duyệt.',
  },
  {
    step: '03',
    title: 'Cùng gìn giữ gia phả & lịch giỗ',
    detail: 'Cập nhật các thế hệ, theo dõi ngày giỗ âm dương và chia sẻ thiệp mời sum họp.',
  },
];

export default function HomePage() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  return (
    <div className="home-page">
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
            Không gian riêng tư để mỗi gia đình tự lập cây gia phả, ghi nhớ ngày giỗ âm lịch và gửi
            thiệp mời sum họp.
          </p>
          <Link className="button primary" to="/dong-ho">
            <Users size={19} /> {user ? 'Mở dòng họ của tôi' : 'Đăng nhập / Tạo dòng họ'}{' '}
            <ArrowRight size={18} />
          </Link>
          <div className="family-note">
            <span className="icon-circle">
              <ShieldCheck size={20} />
            </span>
            <span>
              <strong>
                {user ? 'Xin chào, ' + (user.displayName || user.email) : 'Không gian riêng từng dòng họ'}
              </strong>
              <small>
                {user
                  ? 'Chọn Gia phả, Lịch giỗ hoặc Thành viên để làm việc trên dòng họ của bạn'
                  : 'Tự đăng ký miễn phí bằng Google · Dữ liệu tách biệt và bảo mật theo từng họ'}
              </small>
            </span>
          </div>
        </div>
        <div className="hero-visual">
          <HeritageIllustration />
          <span className="vertical-caption">CÂY CÓ CỘI · NƯỚC CÓ NGUỒN</span>
          <span className="art-caption">Nơi chúng ta bắt đầu.</span>
        </div>
      </section>

      <nav className="home-shortcuts" aria-label="Truy cập nhanh">
        <Link to="/dong-ho">
          <Users size={24} />
          <span>Dòng họ của tôi</span>
          <ArrowRight size={18} />
        </Link>
        <Link to="/gia-pha">
          <BookOpen size={24} />
          <span>Gia phả dòng họ</span>
          <ArrowRight size={18} />
        </Link>
        <Link to="/lich-gio">
          <CalendarDays size={24} />
          <span>Lịch giỗ & Sự kiện</span>
          <ArrowRight size={18} />
        </Link>
      </nav>

      <div className="section-heading">
        <div>
          <p className="eyebrow">TÍNH NĂNG CỐT LÕI</p>
          <h2>Mọi việc gia đình trong một nơi</h2>
        </div>
        <Link className="text-link" to="/dong-ho">
          Mở dòng họ <ArrowRight size={17} />
        </Link>
      </div>

      <div className="home-grid">
        <article className="branch-card">
          <span className="icon-circle">
            <Sprout size={27} />
          </span>
          <h3>
            Từ một gốc rễ,
            <br />
            vươn nhiều nhánh xanh.
          </h3>
          <p>
            Lưu giữ hồ sơ người thân qua nhiều thế hệ, kết nối huyết thống – hôn nhân và tra cứu sơ
            đồ cây trực quan trên cả điện thoại lẫn máy tính.
          </p>
          <Link className="text-link" to="/gia-pha">
            Mở cây gia phả <ArrowRight size={17} />
          </Link>
          <span className="branch-watermark" aria-hidden="true">
            ❧
          </span>
        </article>

        <article className="branch-card">
          <span className="icon-circle">
            <CalendarDays size={25} />
          </span>
          <h3>
            Nhớ ngày giỗ tổ,
            <br />
            trọn vẹn sum vầy.
          </h3>
          <p>
            Tự động đối chiếu ngày giỗ âm lịch sang dương lịch từng năm, phân công chủ sự, chia sẻ
            thiệp mời qua link và tổng hợp số người tham dự theo từng hộ.
          </p>
          <Link className="text-link" to="/lich-gio">
            Xem lịch giỗ <ArrowRight size={17} />
          </Link>
          <span className="branch-watermark" aria-hidden="true">
            ❧
          </span>
        </article>
      </div>

      <section className="family-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">BẮT ĐẦU DỄ DÀNG</p>
            <h2>Ba bước lập gia phả riêng</h2>
          </div>
          <Link className="text-link" to="/dong-ho">
            {user ? 'Quản lý dòng họ' : 'Đăng nhập ngay'} <ArrowRight size={17} />
          </Link>
        </div>
        <div className="people-preview">
          {onboardingSteps.map((item, i) => (
            <Link to="/dong-ho" className="person-preview" key={item.step}>
              <span className={'avatar tone-' + i}>{item.step}</span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
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
    </div>
  );
}
