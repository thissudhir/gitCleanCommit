import { WorkflowOptions } from "./types/index.js";
import { CommitBuilder } from "./prompt/commit-builder.js";

export async function promptCommit(hookFile?: string): Promise<void> {
  const options: WorkflowOptions = { hookFile };
  const commitBuilder = new CommitBuilder();
  await commitBuilder.buildCommit(options);
}
