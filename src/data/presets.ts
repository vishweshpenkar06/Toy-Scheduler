import { PresetWorkload } from '../types';

export const PRESET_WORKLOADS: PresetWorkload[] = [
  {
    id: 'standard',
    name: 'Standard Staggered Workload',
    description: 'Classic textbook scenario with staggered arrival times and mixed burst durations.',
    defaultAlgorithm: 'fifo',
    processes: [
      { pid: 'P1', arrivalTime: 0, burstTime: 8, priority: 3, color: '#2563eb' },
      { pid: 'P2', arrivalTime: 1, burstTime: 4, priority: 1, color: '#0ea5e9' },
      { pid: 'P3', arrivalTime: 2, burstTime: 2, priority: 2, color: '#10b981' },
      { pid: 'P4', arrivalTime: 3, burstTime: 5, priority: 4, color: '#f59e0b' },
    ],
  },
  {
    id: 'convoy',
    name: 'Convoy Effect Demonstration',
    description: 'A massive CPU-bound process arrives first, causing short processes to wait excessively in FCFS.',
    defaultAlgorithm: 'fifo',
    processes: [
      { pid: 'P1', arrivalTime: 0, burstTime: 24, priority: 2, color: '#ef4444' },
      { pid: 'P2', arrivalTime: 1, burstTime: 2, priority: 1, color: '#10b981' },
      { pid: 'P3', arrivalTime: 2, burstTime: 3, priority: 1, color: '#2563eb' },
      { pid: 'P4', arrivalTime: 3, burstTime: 1, priority: 1, color: '#8b5cf6' },
    ],
  },
  {
    id: 'preemption',
    name: 'SRTF & Priority Preemption Showcase',
    description: 'Demonstrates real-time CPU preemption when shorter or higher priority tasks arrive mid-execution.',
    defaultAlgorithm: 'srtf',
    processes: [
      { pid: 'P1', arrivalTime: 0, burstTime: 10, priority: 4, color: '#8b5cf6' },
      { pid: 'P2', arrivalTime: 2, burstTime: 3, priority: 1, color: '#10b981' },
      { pid: 'P3', arrivalTime: 4, burstTime: 1, priority: 2, color: '#f59e0b' },
      { pid: 'P4', arrivalTime: 6, burstTime: 4, priority: 3, color: '#2563eb' },
    ],
  },
  {
    id: 'round-robin',
    name: 'Round Robin Quantum Slicing',
    description: 'Equal arrival times to highlight time slicing and context switches under Round Robin.',
    defaultAlgorithm: 'roundRobin',
    defaultQuantum: 2,
    processes: [
      { pid: 'P1', arrivalTime: 0, burstTime: 6, priority: 1, color: '#2563eb' },
      { pid: 'P2', arrivalTime: 0, burstTime: 4, priority: 1, color: '#0ea5e9' },
      { pid: 'P3', arrivalTime: 0, burstTime: 5, priority: 1, color: '#8b5cf6' },
      { pid: 'P4', arrivalTime: 0, burstTime: 3, priority: 1, color: '#10b981' },
    ],
  },
  {
    id: 'priority-test',
    name: 'Priority Scheduling Matrix',
    description: 'Multiple priority levels to compare preemptive vs non-preemptive priority execution.',
    defaultAlgorithm: 'priorityPreemptive',
    processes: [
      { pid: 'P1', arrivalTime: 0, burstTime: 7, priority: 3, color: '#f59e0b' },
      { pid: 'P2', arrivalTime: 2, burstTime: 4, priority: 1, color: '#10b981' },
      { pid: 'P3', arrivalTime: 3, burstTime: 2, priority: 0, color: '#ef4444' },
      { pid: 'P4', arrivalTime: 5, burstTime: 6, priority: 2, color: '#2563eb' },
    ],
  },
];
