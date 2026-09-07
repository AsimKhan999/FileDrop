interface LogoProps {
  className?: string;
}

export default function Logo({ className }: LogoProps) {
  return (
    <span className={`logo ${className || ""}`}>
      File<span className="logo-accent">Drop</span>
    </span>
  );
}
