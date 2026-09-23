import { Process, TimelineSlice, DecisionEntry } from '../types';

export function generateDecisionLog(
  timeline: TimelineSlice[],
  processes: Process[],
  algorithm: string
): DecisionEntry[] {
  if (timeline.length === 0) return [];

  const log: DecisionEntry[] = [];
  const processMap = new Map<string, Process>();
  processes.forEach((p) => processMap.set(p.pid, p));

  for (let i = 0; i < timeline.length; i++) {
    const slice = timeline[i];
    if (slice.kind === 'CONTEXT_SWITCH') {
      log.push({
        time: slice.start,
        message: `t=${slice.start}: context switch on core ${slice.core ?? 0} (${slice.end - slice.start}ms overhead)`,
      });
      continue;
    }
    if (slice.kind === 'IO') {
      log.push({
        time: slice.start,
        message: `t=${slice.start}: ${slice.pid} blocked on I/O (${slice.end - slice.start}ms)`,
      });
      continue;
    }
    if (slice.pid === 'idle') {
      log.push({
        time: slice.start,
        message: `t=${slice.start}: CPU idle — no processes available`,
      });
      continue;
    }

    const proc = processMap.get(slice.pid);
    const remaining = proc ? proc.burstTime - (slice.end - slice.start) : 0;
    const duration = slice.end - slice.start;

    // Look ahead to see what happens next
    const nextSlice = timeline[i + 1];

    switch (algorithm) {
      case 'fifo':
        if (slice.start === proc?.arrivalTime) {
          log.push({
            time: slice.start,
            message: `t=${slice.start}: ${slice.pid} arrives and is first in the FCFS queue, runs for ${duration}ms`,
          });
        } else if (nextSlice && nextSlice.pid !== 'idle' && nextSlice.pid !== slice.pid) {
          log.push({
            time: slice.start,
            message: `t=${slice.start}: ${slice.pid} runs to completion (${duration}ms), then ${nextSlice.pid} goes next`,
          });
        } else {
          log.push({
            time: slice.start,
            message: `t=${slice.start}: ${slice.pid} runs for ${duration}ms`,
          });
        }
        break;

      case 'sjf':
        if (nextSlice && nextSlice.pid !== slice.pid) {
          log.push({
            time: slice.start,
            message: `t=${slice.start}: ${slice.pid} is shortest job (${proc?.burstTime}ms burst), runs to completion`,
          });
        } else {
          log.push({
            time: slice.start,
            message: `t=${slice.start}: ${slice.pid} runs to completion (${duration}ms)`,
          });
        }
        break;

      case 'srtf':
        if (i > 0 && timeline[i - 1].pid !== slice.pid && timeline[i - 1].pid !== 'idle') {
          log.push({
            time: slice.start,
            message: `t=${slice.start}: ${slice.pid} has shorter remaining time, preempts ${timeline[i - 1].pid}`,
          });
        } else {
          log.push({
            time: slice.start,
            message: `t=${slice.start}: ${slice.pid} runs for ${duration}ms (remaining: ${proc ? proc.burstTime - duration : 0}ms)`,
          });
        }
        break;

      case 'roundRobin':
        if (nextSlice && nextSlice.pid !== slice.pid && nextSlice.pid !== 'idle') {
          if (remaining > 0) {
            log.push({
              time: slice.start,
              message: `t=${slice.start}: ${slice.pid}'s quantum expires, rotates to back of queue`,
            });
          } else {
            log.push({
              time: slice.start,
              message: `t=${slice.start}: ${slice.pid} finishes, ${nextSlice.pid} gets CPU`,
            });
          }
        } else {
          log.push({
            time: slice.start,
            message: `t=${slice.start}: ${slice.pid} runs for ${duration}ms`,
          });
        }
        break;

      case 'priorityNonPreemptive':
      case 'priorityPreemptive':
        if (nextSlice && nextSlice.pid !== slice.pid && algorithm === 'priorityPreemptive') {
          log.push({
            time: slice.start,
            message: `t=${slice.start}: ${nextSlice.pid} has higher priority, preempts ${slice.pid}`,
          });
        } else {
          log.push({
            time: slice.start,
            message: `t=${slice.start}: ${slice.pid} (priority ${proc?.priority ?? 'default'}) runs for ${duration}ms`,
          });
        }
        break;

      case 'priorityAging':
        if (nextSlice && nextSlice.pid !== slice.pid && nextSlice.pid !== 'idle') {
          log.push({
            time: slice.start,
            message: `t=${slice.start}: ${slice.pid} runs ${duration}ms; aging may promote waiting processes`,
          });
        } else {
          log.push({
            time: slice.start,
            message: `t=${slice.start}: ${slice.pid} runs for ${duration}ms`,
          });
        }
        break;

      case 'multiLevelQueue':
        log.push({
          time: slice.start,
          message: `t=${slice.start}: ${slice.pid} selected from its priority queue, runs ${duration}ms`,
        });
        break;

      case 'multiLevelFeedback':
        if (nextSlice && nextSlice.pid !== slice.pid && remaining > 0) {
          log.push({
            time: slice.start,
            message: `t=${slice.start}: ${slice.pid} uses ${duration}ms slice, may be demoted to lower queue`,
          });
        } else {
          log.push({
            time: slice.start,
            message: `t=${slice.start}: ${slice.pid} runs for ${duration}ms`,
          });
        }
        break;

      case 'hrrn':
        log.push({
          time: slice.start,
          message: `t=${slice.start}: ${slice.pid} has highest response ratio next, runs ${duration}ms`,
        });
        break;

      case 'lrtf':
        log.push({
          time: slice.start,
          message: `t=${slice.start}: ${slice.pid} has longest remaining time, runs ${duration}ms`,
        });
        break;

      case 'lottery':
        log.push({
          time: slice.start,
          message: `t=${slice.start}: ${slice.pid} wins lottery draw, runs ${duration}ms`,
        });
        break;

      case 'stride':
        log.push({
          time: slice.start,
          message: `t=${slice.start}: ${slice.pid} has smallest pass value, runs ${duration}ms`,
        });
        break;

      case 'wfq':
        log.push({
          time: slice.start,
          message: `t=${slice.start}: ${slice.pid} has lowest virtual finish tag, runs ${duration}ms`,
        });
        break;

      case 'edf':
        log.push({
          time: slice.start,
          message: `t=${slice.start}: ${slice.pid} has earliest deadline, runs ${duration}ms`,
        });
        break;

      case 'rms':
        log.push({
          time: slice.start,
          message: `t=${slice.start}: ${slice.pid} has shortest period (static priority), runs ${duration}ms`,
        });
        break;

      case 'adaptive':
        log.push({
          time: slice.start,
          message: `t=${slice.start}: ${slice.pid} selected by adaptive RR (quantum may shrink/expand), runs ${duration}ms`,
        });
        break;

      default:
        log.push({
          time: slice.start,
          message: `t=${slice.start}: ${slice.pid} runs for ${duration}ms`,
        });
    }
  }

  return log;
}
