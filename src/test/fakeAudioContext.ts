import { vi } from "vitest";

/** テスト用の最小 AudioParam */
export class FakeAudioParam {
  value: number;
  readonly calls: { method: string; value: number; time: number }[] = [];
  constructor(value = 1) {
    this.value = value;
  }
  setValueAtTime(value: number, time: number) {
    this.calls.push({ method: "setValueAtTime", value, time });
    this.value = value;
    return this;
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.calls.push({ method: "linearRampToValueAtTime", value, time });
    this.value = value;
    return this;
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.calls.push({ method: "exponentialRampToValueAtTime", value, time });
    this.value = value;
    return this;
  }
  setTargetAtTime(value: number, time: number) {
    this.calls.push({ method: "setTargetAtTime", value, time });
    this.value = value;
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}

export class FakeNode {
  readonly connections: FakeNode[] = [];
  connect(dest: FakeNode) {
    this.connections.push(dest);
    return dest;
  }
  disconnect() {
    this.connections.length = 0;
  }
}

export class FakeGainNode extends FakeNode {
  gain = new FakeAudioParam(1);
}

export class FakeOscillatorNode extends FakeNode {
  type = "sine";
  frequency = new FakeAudioParam(440);
  detune = new FakeAudioParam(0);
  started: number | undefined;
  stopped: number | undefined;
  onended: (() => void) | null = null;
  start(when = 0) {
    this.started = when;
  }
  stop(when = 0) {
    this.stopped = when;
  }
}

export class FakeAudioContext {
  currentTime = 0;
  state: AudioContextState = "suspended";
  destination = new FakeNode();
  readonly oscillators: FakeOscillatorNode[] = [];
  readonly gains: FakeGainNode[] = [];
  resume = vi.fn(async () => {
    this.state = "running";
  });
  close = vi.fn(async () => {
    this.state = "closed";
  });
  createOscillator() {
    const o = new FakeOscillatorNode();
    this.oscillators.push(o);
    return o;
  }
  createGain() {
    const g = new FakeGainNode();
    this.gains.push(g);
    return g;
  }
}

export function createFakeContextFactory() {
  const contexts: FakeAudioContext[] = [];
  const createContext = () => {
    const ctx = new FakeAudioContext();
    contexts.push(ctx);
    return ctx as unknown as AudioContext;
  };
  return { contexts, createContext };
}
