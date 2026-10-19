import "server-only";
/** End-of-day markdowns (0079); null before it is applied: nothing shown. */
import { db } from "./client";
import { markdownBoard, type MarkdownBoard } from "@/lib/markdowns";

export async function getMarkdowns(location: string | null): Promise<MarkdownBoard | null> {
  const c = await db();
  const { data, error } = await c.rpc("markdown_suggestions", { p_location: location });
  if (error) return null;
  return markdownBoard(data);
}
