import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Clock3, MapPin, Sprout } from 'lucide-react';
import { demoEvent } from '../../shared/data/demo';
export default function InvitationPage() {
  const [attendance, setAttendance] = useState<'yes' | 'no'>('yes');
  const [adults, setAdults] = useState('2');
  const [children, setChildren] = useState('0');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saved, setSaved] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    const a = Number(adults),
      c = Number(children);
    if (
      attendance === 'yes' &&
      (!adults.trim() ||
        !children.trim() ||
        !Number.isInteger(a) ||
        !Number.isInteger(c) ||
        a < 0 ||
        c < 0 ||
        a + c < 1 ||
        a + c > 100)
    ) {
      setError('Vui lòng nhập số người nguyên, không âm, tổng từ 1 đến 100 cho bản thử.');
      return;
    }
    setError('');
    setSaved(attendance === 'yes' ? a + ' người lớn, ' + c + ' trẻ em' : 'Gia đình không tham dự');
    setSubmitted(true);
  }
  return (
    <>
      <Link className="back-link" to="/lich-gio">
        <ArrowLeft size={18} /> Về lịch giỗ
      </Link>
      <div className="invitation-layout">
        <article className="invitation-card">
          <div className="invitation-corner top" />
          <p className="eyebrow">GIA ĐÌNH HỌ TRẦN</p>
          <Sprout className="invite-sprout" size={42} strokeWidth={1} />
          <p className="invitation-salutation">Trân trọng kính mời</p>
          <h1>
            Về một ngày
            <br />
            <em>sum họp.</em>
          </h1>
          <div className="ornament-line">
            <span>✦</span>
          </div>
          <p>
            Con cháu cùng trở về dâng hương,
            <br />
            tưởng nhớ và dự lễ giỗ
          </p>
          <h2>Ông Trần Văn An</h2>
          <p className="invitation-date">{demoEvent.date}</p>
          <p className="icon-text">
            <Clock3 size={18} />
            {demoEvent.time} · Chủ nhật
          </p>
          <p className="icon-text">
            <MapPin size={18} />
            {demoEvent.address}
          </p>
          <p className="invite-host">Chủ sự: {demoEvent.host}</p>
          <p className="invite-footer">
            Sự hiện diện của gia đình là niềm ấm áp
            <br />
            cho ngày đoàn viên.
          </p>
          <div className="invitation-corner bottom" />
        </article>
        <section className="rsvp-panel">
          <p className="eyebrow">MỘT LỜI NHẮN ĐỂ CHUẨN BỊ CHU ĐÁO</p>
          <h2>
            Gia đình mình
            <br />
            có tham dự không?
          </h2>
          <p className="muted">Cho gia chủ biết số người để chuẩn bị bữa cơm sum họp.</p>
          <div className="notice">
            Đây là thiệp mẫu. Phản hồi chỉ để thử giao diện trong phiên này và chưa gửi đến gia chủ.
          </div>
          {submitted ? (
            <div className="rsvp-success" role="status">
              <span className="icon-circle">
                <Check size={28} />
              </span>
              <h3>Đã ghi nhận bản thử</h3>
              <p>{saved}</p>
              <p className="subtle">Bạn có thể sửa và thử lại bên dưới.</p>
              <button className="button secondary" onClick={() => setSubmitted(false)}>
                Sửa phản hồi
              </button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <fieldset>
                <legend className="sr-only">Gia đình có tham dự không?</legend>
                <label className={'attendance-option ' + (attendance === 'yes' ? 'selected' : '')}>
                  <input
                    type="radio"
                    name="attendance"
                    value="yes"
                    checked={attendance === 'yes'}
                    onChange={() => setAttendance('yes')}
                  />{' '}
                  Gia đình sẽ tham dự
                </label>
                <label className={'attendance-option ' + (attendance === 'no' ? 'selected' : '')}>
                  <input
                    type="radio"
                    name="attendance"
                    value="no"
                    checked={attendance === 'no'}
                    onChange={() => setAttendance('no')}
                  />{' '}
                  Xin phép vắng mặt
                </label>
              </fieldset>
              {attendance === 'yes' && (
                <div className="guest-counts">
                  <label>
                    Người lớn
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="100"
                      step="1"
                      value={adults}
                      onChange={(e) => setAdults(e.target.value)}
                      aria-invalid={!!error}
                      aria-describedby={error ? 'rsvp-error' : undefined}
                    />
                  </label>
                  <label>
                    Trẻ em
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="100"
                      step="1"
                      value={children}
                      onChange={(e) => setChildren(e.target.value)}
                      aria-invalid={!!error}
                      aria-describedby={error ? 'rsvp-error' : undefined}
                    />
                  </label>
                </div>
              )}
              {error && (
                <p className="form-error" id="rsvp-error" role="alert">
                  {error}
                </p>
              )}
              <button className="button primary full-width" type="submit">
                <Check size={19} /> Xác nhận bản thử
              </button>
              <p className="subtle">Không cần đăng nhập để thử phản hồi.</p>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
