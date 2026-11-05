import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, List, Network, Search } from 'lucide-react';
import { people } from '../../shared/data/demo';
import { ZoomableTree } from './ZoomableTree';
export default function PeoplePage() {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'tree'>('list');
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .toLowerCase();
  const results = people.filter((p) => normalize(p.name).includes(normalize(search)));
  return (
    <section>
      <p className="eyebrow">GIA ĐÌNH HỌ TRẦN</p>
      <h1>Những nhánh gia đình</h1>
      <p className="page-intro">Tìm một người thân, mở lại một câu chuyện.</p>
      <div className="people-toolbar">
        <label className="search-field">
          <Search size={21} />
          <span className="sr-only">Tìm người trong gia phả</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nhập tên người thân…"
          />
        </label>
        <div className="segmented" aria-label="Cách xem gia phả">
          <button aria-pressed={view === 'list'} onClick={() => setView('list')}>
            <List size={18} />
            Danh sách
          </button>
          <button aria-pressed={view === 'tree'} onClick={() => setView('tree')}>
            <Network size={18} />
            Sơ đồ
          </button>
        </div>
      </div>
      {view === 'tree' && !search ? (
        <>
          <p className="subtle">Sơ đồ nhánh mẫu · Chạm vào tên để xem hồ sơ.</p>
          <ZoomableTree>
            <div className="family-tree">
              <div className="tree-row">
                {people.slice(0, 2).map((p) => (
                  <Link className="tree-person" to={'/gia-pha/' + p.id} key={p.id}>
                    <span className="avatar">{p.initials}</span>
                    <strong>{p.name}</strong>
                    <small>{p.generation}</small>
                  </Link>
                ))}
              </div>
              <div className="tree-stem" />
              <div className="tree-row">
                {people.slice(2, 5).map((p) => (
                  <Link className="tree-person" to={'/gia-pha/' + p.id} key={p.id}>
                    <span className="avatar">{p.initials}</span>
                    <strong>{p.name}</strong>
                    <small>{p.generation}</small>
                  </Link>
                ))}
              </div>
              <div className="tree-stem" />
              <div className="tree-row">
                {people.slice(5).map((p) => (
                  <Link className="tree-person" to={'/gia-pha/' + p.id} key={p.id}>
                    <span className="avatar">{p.initials}</span>
                    <strong>{p.name}</strong>
                    <small>{p.generation}</small>
                  </Link>
                ))}
              </div>
            </div>
          </ZoomableTree>
          <p className="subtle">
            Minh họa các thế hệ; sơ đồ quan hệ đầy đủ sẽ được tích hợp ở bước gia phả.
          </p>
        </>
      ) : (
        <>
          <p className="result-count" role="status">
            {results.length} hồ sơ trong gia phả mẫu
          </p>
          <div className="person-list">
            {results.map((p, i) => (
              <Link to={'/gia-pha/' + p.id} className="person-list-item" key={p.id}>
                <span className={'avatar tone-' + (i % 4)}>{p.initials}</span>
                <span className="person-list-name">
                  <strong>{p.name}</strong>
                  <small>{p.years}</small>
                </span>
                <span className="person-list-generation">{p.generation}</span>
                <ArrowRight size={19} />
              </Link>
            ))}
          </div>
          {!results.length && (
            <div className="empty-state">
              <Search size={32} />
              <h2>Chưa tìm thấy người thân</h2>
              <p>Thử tìm bằng tên ngắn hơn hoặc không dấu.</p>
              <button className="button secondary" onClick={() => setSearch('')}>
                Xóa tìm kiếm
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
