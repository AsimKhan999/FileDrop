import { useNavigate } from "react-router-dom";
import Logo from "../components/Logo";

function Home() {
  const navigate = useNavigate();

  return (
    <div className="home">
      <div className="home-hero">
        <span className="home-badge">PRIVATE & SECURE</span>
        <h1>
          <Logo />
        </h1>
        <p className="home-tagline">
          Send files between your devices instantly.
          <br />
          No accounts. No cloud. Just a link.
        </p>
      </div>

      <div className="home-actions">
        <button
          className="home-action-btn primary"
          onClick={() => navigate("/upload")}
        >
          <svg
            className="home-action-icon"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload Files
        </button>
        <button
          className="home-action-btn"
          onClick={() => navigate("/p2p")}
        >
          <svg
            className="home-action-icon"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
          LAN Transfer
        </button>
      </div>

      <div className="home-features">
        <div className="home-feature">
          <svg
            className="home-feature-icon"
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="var(--green-primary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span>Shareable links</span>
        </div>
        <div className="home-feature">
          <svg
            className="home-feature-icon"
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="var(--green-primary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>Auto-expiring</span>
        </div>
        <div className="home-feature">
          <svg
            className="home-feature-icon"
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="var(--green-primary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>Password option</span>
        </div>
      </div>

      <p className="home-footer">Powered by FileDrop</p>
    </div>
  );
}

export default Home;
