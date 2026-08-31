import type { LogPipelineRule } from "@pulseops/shared";
import { SensitiveDataScanner } from "./sensitive-scanner.js";

export interface LogPipelineResult {
  readonly dropped: boolean;
  readonly wasSampledOut: boolean;
  readonly message: string;
  readonly level: string;
  readonly attributes: Record<string, unknown>;
  readonly appliedProcessors: string[];
}

export class LogPipelineProcessorEngine {
  processLogEvent(
    event: {
      projectId: string;
      message: string;
      level?: string | undefined;
      source?: string | undefined;
      attributes?: Record<string, unknown> | undefined;
    },
    rules: LogPipelineRule[],
  ): LogPipelineResult {
    let currentMessage = event.message || "";
    let currentLevel = event.level || "info";
    let currentAttributes: Record<string, unknown> = { ...(event.attributes || {}) };
    let isDropped = false;
    let isSampledOut = false;
    const applied: string[] = [];

    // Sort rules by execution order
    const sortedRules = [...rules].filter((r) => r.enabled).sort((a, b) => a.order - b.order);

    for (const rule of sortedRules) {
      for (const processor of rule.processors) {
        if (!processor.enabled || isDropped) continue;

        switch (processor.type) {
          case "parse_json": {
            if (
              typeof currentMessage === "string" &&
              currentMessage.trim().startsWith("{") &&
              currentMessage.trim().endsWith("}")
            ) {
              try {
                const parsed = JSON.parse(currentMessage.trim()) as Record<string, unknown>;
                if (typeof parsed === "object" && parsed !== null) {
                  if (typeof parsed.message === "string") {
                    currentMessage = parsed.message;
                  } else if (typeof parsed.msg === "string") {
                    currentMessage = parsed.msg;
                  }
                  if (typeof parsed.level === "string") {
                    currentLevel = parsed.level;
                  } else if (typeof parsed.lvl === "string") {
                    currentLevel = parsed.lvl;
                  }
                  currentAttributes = { ...currentAttributes, ...parsed };
                  applied.push(`parse_json:${processor.name}`);
                }
              } catch {
                // Not valid JSON, keep as is
              }
            }
            break;
          }

          case "remap_fields": {
            if (processor.config.fieldMappings) {
              for (const [oldKey, newKey] of Object.entries(processor.config.fieldMappings)) {
                if (oldKey in currentAttributes) {
                  currentAttributes[newKey] = currentAttributes[oldKey];
                  delete currentAttributes[oldKey];
                  applied.push(`remap_fields:${processor.name}`);
                }
              }
            }
            break;
          }

          case "redact_regex": {
            const scan = SensitiveDataScanner.scanAndRedact(
              currentMessage,
              processor.config.redactionPatterns,
              processor.config.redactionReplacement ?? "[REDACTED]",
            );
            currentMessage = scan.redactedText;

            const objScan = SensitiveDataScanner.scanObject(
              currentAttributes,
              processor.config.redactionPatterns,
            );
            currentAttributes = objScan.redactedObj;

            if (scan.foundSecretsCount > 0 || objScan.foundSecretsCount > 0) {
              applied.push(`redact_regex:${processor.name}`);
            }
            break;
          }

          case "drop_filter": {
            const filterStr = processor.config.dropFilter?.toLowerCase().trim();
            if (filterStr) {
              if (
                currentMessage.toLowerCase().includes(filterStr) ||
                currentLevel.toLowerCase() === filterStr ||
                (event.source && event.source.toLowerCase().includes(filterStr))
              ) {
                isDropped = true;
                applied.push(`drop_filter:${processor.name}`);
              }
            }
            break;
          }

          case "sample_rate": {
            const samplePercent = processor.config.sampleRatePercent ?? 100;
            if (samplePercent < 100) {
              const roll = Math.random() * 100;
              if (roll > samplePercent) {
                isDropped = true;
                isSampledOut = true;
                applied.push(`sample_rate:${processor.name}`);
              }
            }
            break;
          }

          case "add_tags": {
            if (processor.config.tags) {
              currentAttributes = {
                ...currentAttributes,
                ...processor.config.tags,
              };
              applied.push(`add_tags:${processor.name}`);
            }
            break;
          }
        }
      }
    }

    return {
      dropped: isDropped,
      wasSampledOut: isSampledOut,
      message: currentMessage,
      level: currentLevel,
      attributes: currentAttributes,
      appliedProcessors: applied,
    };
  }
}
