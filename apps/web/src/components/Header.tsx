import { Link } from "react-router-dom";
import "./Header.css";

export default function Header() {
  return (
    <header className="app-header">
      <Link to="/" className="header-logo">
        <img src="/logo.png" alt="FileDrop" className="header-logo-img" />
        <span className="header-logo-text">
          File<span className="logo-accent">Drop</span>
        </span>
      </Link>
    </header>
  );
}
