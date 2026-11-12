"use client";

import { useEffect } from "react";
import { noteDeviceAction } from "@/lib/actions/security";

const KEY = "sixties_device_key";
const SEEN = "sixties_device_noted";

/** A short name for the browser and the system it runs on: "Chrome on Windows". */
export function deviceName(agent: string): string {
  const browser = /Edg\//.test(agent)
    ? "Edge"
    : /OPR\//.test(agent)
      ? "Opera"
      : /Firefox\//.test(agent)
        ? "Firefox"
        : /Chrome\//.test(agent)
          ? "Chrome"
          : /Safari\//.test(agent)
            ? "Safari"
            : "A browser";
  const system = /iPhone|iPad/.test(agent)
    ? /iPad/.test(agent)
      ? "iPad"
      : "iPhone"
    : /Android/.test(agent)
      ? "Android"
      : /Windows/.test(agent)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(agent)
          ? "Mac"
          : /Linux/.test(agent)
            ? "Linux"
            : "a device";
  return `${browser} on ${system}`;
}

/**
 * The device a person signs in on (0099), told once a visit: a device kept
 * key, never anything about the person. One new to someone who may see the
 * books is an alert for the owner. Nothing shown.
 */
export function DeviceNote() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SEEN)) return;
      let key = localStorage.getItem(KEY);
      if (!key) {
        key = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
        localStorage.setItem(KEY, key);
      }
      sessionStorage.setItem(SEEN, "1");
      void noteDeviceAction(key, deviceName(navigator.userAgent));
    } catch {
      /* no storage: nothing noted */
    }
  }, []);
  return null;
}
