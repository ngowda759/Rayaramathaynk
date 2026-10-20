"use client";

import { createContext, useContext, type JSX, type ReactNode } from "react";
import { m } from "framer-motion";

import { enterVariants, staggerChildren } from "@/lib/seva/motion";

type RevealTag = "div" | "section" | "ul" | "ol" | "li";

const TAGS = { div: m.div, section: m.section, ul: m.ul, ol: m.ol, li: m.li } as const;

interface RevealBaseProps {
  /** The element to render. Default "div". */
  as?: RevealTag;
  className?: string;
  children?: ReactNode;
  id?: string;
  role?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}

/** True inside a Stagger: its Reveals then follow the container's timing instead of starting on their own. */
const InStagger = createContext(false);

export interface RevealProps extends RevealBaseProps {
  /** Seconds to wait before arriving (ignored inside a Stagger, which sets the order). */
  delay?: number;
}

/** Content that arrives with the module spring: rises, grows a little and fades in. Use once per block or list item. */
export function Reveal({ as = "div", delay, children, ...props }: RevealProps): JSX.Element {
  const inStagger = useContext(InStagger);
  const Tag = TAGS[as];
  if (inStagger) {
    return (
      <Tag variants={enterVariants} {...props}>
        {children}
      </Tag>
    );
  }
  return (
    <Tag
      variants={enterVariants}
      initial="hidden"
      animate="shown"
      transition={delay ? { delay } : undefined}
      {...props}
    >
      {children}
    </Tag>
  );
}

export interface StaggerProps extends RevealBaseProps {
  /** Seconds between one child's arrival and the next. Default 0.055. */
  step?: number;
}

/** A list whose Reveal children arrive one after another. */
export function Stagger({ as = "div", step = 0.055, children, ...props }: StaggerProps): JSX.Element {
  const Tag = TAGS[as];
  return (
    <InStagger.Provider value>
      <Tag variants={staggerChildren(step)} initial="hidden" animate="shown" {...props}>
        {children}
      </Tag>
    </InStagger.Provider>
  );
}

export default Reveal;
