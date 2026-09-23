import { Process } from '../types';
import { COLORS } from '../components/Header';

export type WorkloadProfile = 'classic' | 'io' | 'deadline' | 'weighted';

export function generateWorkload(profile: WorkloadProfile, count = 5, rng: () => number = Math.random): Process[] {
  const n = Math.max(1, Math.min(20, Math.floor(count)));
  const processes: Process[] = [];
  for (let i = 0; i < n; i++) {
    const color = COLORS[i % COLORS.length];
    const arrival = i === 0 ? 0 : Math.floor(rng() * 8);
    const burst = Math.floor(rng() * 8) + 2;
    const pid = `P${i + 1}`;
    if (profile === 'io') {
      const cpu1 = Math.max(1, Math.floor(burst / 2));
      const io = Math.floor(rng() * 3) + 1;
      const cpu2 = Math.max(1, burst - cpu1);
      processes.push({
        pid, arrivalTime: arrival, burstTime: cpu1 + cpu2, color,
        bursts: [
          { type: 'cpu', duration: cpu1 },
          { type: 'io', duration: io },
          { type: 'cpu', duration: cpu2 },
        ],
      });
    } else if (profile === 'deadline') {
      const period = [4, 6, 8, 10, 12][i % 5];
      processes.push({
        pid, arrivalTime: arrival, burstTime: burst, color,
        deadline: arrival + period,
        period,
        priority: i % 5,
      });
    } else if (profile === 'weighted') {
      const tickets = 1 + Math.floor(rng() * 8);
      processes.push({
        pid, arrivalTime: arrival, burstTime: burst, color,
        tickets, weight: tickets,
        priority: i % 5,
      });
    } else {
      processes.push({
        pid, arrivalTime: arrival, burstTime: burst, color,
        priority: Math.floor(rng() * 5),
      });
    }
  }
  return processes;
}
