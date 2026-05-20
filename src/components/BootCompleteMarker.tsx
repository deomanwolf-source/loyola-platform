import { type ReactNode, useEffect } from "react";

type BootWindow = Window & {
  __loyolaBootComplete?: () => void;
};

export function BootCompleteMarker({ children }: { children: ReactNode }) {
  useEffect(() => {
    (window as BootWindow).__loyolaBootComplete?.();
  }, []);

  return <>{children}</>;
}
