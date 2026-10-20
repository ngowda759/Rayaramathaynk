import type { JSX } from "react";

export interface BilingualProps {
  en: string;
  kn?: string | null;
  as?: "span" | "div" | "h1" | "h2" | "h3" | "label" | "th";
  className?: string;
  /** Only used when `as="label"`. */
  htmlFor?: string;
}

/**
 * English first, Kannada on its own line under it (`.kn` block from styles/seva/tokens.css).
 * The Kannada line is left out when `kn` is empty.
 */
export function Bilingual({ en, kn, as = "span", className, htmlFor }: BilingualProps): JSX.Element {
  const knText = kn?.trim();
  const content = (
    <>
      {en}
      {knText ? (
        <span className="kn" lang="kn">
          {knText}
        </span>
      ) : null}
    </>
  );

  if (as === "label") {
    return (
      <label className={className} htmlFor={htmlFor}>
        {content}
      </label>
    );
  }

  const Tag = as;
  return <Tag className={className}>{content}</Tag>;
}

export default Bilingual;
