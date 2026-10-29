import { Link } from 'react-router-dom';
import { ShieldCheck, Users } from 'lucide-react';
import { members } from '../../shared/data/demo';
export default function MembersPage() {
  return (
    <section>
      <p className="eyebrow">CÙNG NHAU GÌN GIỮ</p>
      <h1>Thành viên dòng họ</h1>
      <p className="page-intro">Những người đang cùng chăm chút gia phả của gia đình.</p>
      <div className="notice">
        <Users size={20} />
        <span>
          Danh sách minh họa. Để quản lý thành viên có lưu dữ liệu local, mở Dòng họ của tôi.
        </span>
      </div>
      <Link className="button primary" to="/dong-ho">
        Quản lý dòng họ của tôi
      </Link>
      <div className="person-list">
        {members.map((m, i) => (
          <div className="person-list-item" key={m.name}>
            <span className={'avatar tone-' + i}>{m.initials}</span>
            <span className="person-list-name">
              <strong>{m.name}</strong>
              <small>{m.role}</small>
            </span>
            <ShieldCheck size={21} />
          </div>
        ))}
      </div>
    </section>
  );
}
