import { useReducer, useState, type KeyboardEvent } from "react";
import { Delete, RotateCcw } from "lucide-react";

type Operator = "+" | "−" | "×" | "÷";
type CalculatorState = { display: string; stored: number | null; operator: Operator | null; fresh: boolean };
const initial: CalculatorState = { display: "0", stored: null, operator: null, fresh: true };
const operators: Operator[] = ["+", "−", "×", "÷"];

function result(left: number, right: number, operator: Operator): string {
  const value = operator === "+" ? left + right : operator === "−" ? left - right : operator === "×" ? left * right : right === 0 ? NaN : left / right;
  return Number.isFinite(value) ? String(Number(value.toPrecision(12))) : "Error";
}

function calculate(current: CalculatorState, key: string): CalculatorState {
  if (key === "AC") return initial;
  const state = current.display === "Error" ? initial : current;
  if (/^\d$/.test(key) || key === ".") {
    const previous = state.fresh ? "0" : state.display;
    if (previous.length >= 12 || (key === "." && previous.includes("."))) return state;
    const display = key === "." ? `${previous}.` : previous === "0" ? key : previous + key;
    return { ...state, display, fresh: false };
  }
  if (key === "backspace") {
    const shortened = state.fresh ? "0" : state.display.slice(0, -1);
    return { ...state, display: shortened && shortened !== "-" ? shortened : "0", fresh: false };
  }
  if (key === "+/−") return { ...state, display: String(-Number(state.display)) };
  if (key === "%") return { ...state, display: String(Number((Number(state.display) / 100).toPrecision(12))) };
  if (operators.includes(key as Operator)) {
    const display = state.operator && state.stored !== null && !state.fresh ? result(state.stored, Number(state.display), state.operator) : state.display;
    return { display, stored: Number(display), operator: key as Operator, fresh: true };
  }
  if (key === "=" && state.operator && state.stored !== null) {
    return { display: result(state.stored, Number(state.display), state.operator), stored: null, operator: null, fresh: true };
  }
  return state;
}

const keys = ["AC", "+/−", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "0", ".", "backspace", "="];
const names: Record<string, string> = { "AC": "Clear", "+/−": "Change sign", "%": "Percent", "÷": "Divide", "×": "Multiply", "−": "Subtract", "+": "Add", "=": "Equals", "backspace": "Delete digit", ".": "Decimal point" };

export function TallyCalculator() {
  const [state, dispatch] = useReducer(calculate, initial);
  const [straight, setStraight] = useState(false);
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Enter" && event.target !== event.currentTarget) return;
    const key = ({ "*": "×", "/": "÷", "-": "−", "Enter": "=", "Escape": "AC", "Delete": "AC", "Backspace": "backspace" } as Record<string, string>)[event.key] ?? event.key;
    if (!keys.includes(key)) return;
    event.preventDefault();
    dispatch(key);
  }
  return <div className="calculator-stage">
    <section className={`calculator${straight ? " is-straight" : ""}`} aria-label="Quick calculator" aria-describedby="calculator-help" tabIndex={0} onKeyDown={onKeyDown}>
      <div className="calculator-front">
        <div className="calculator-brand"><span>tally</span><div className="calculator-solar" aria-hidden="true"><i /><i /><i /><i /></div></div>
        <div className="calculator-display"><span className="calculator-operation" aria-hidden="true">{state.operator && state.stored !== null ? `${state.stored} ${state.operator}` : ""}</span><output aria-label="Calculator result" aria-live="polite">{state.display}</output></div>
        <div className="calculator-keypad">{keys.map(key => <button key={key} type="button" aria-label={names[key] ?? key} aria-pressed={operators.includes(key as Operator) ? state.operator === key : undefined} className={`calculator-key${operators.includes(key as Operator) ? " operator" : ""}${key === "=" ? " equals" : ""}${["AC", "+/−", "%"].includes(key) ? " utility" : ""}`} onClick={() => dispatch(key)}>{key === "backspace" ? <Delete size={19} aria-hidden="true" /> : key}</button>)}</div>
        <div className="calculator-base" aria-hidden="true"><span /><span /><span /></div>
      </div>
    </section>
    <div className="calculator-caption"><p id="calculator-help">A working calculator. Try the keys.</p><button type="button" className="calculator-view" aria-pressed={straight} onClick={() => setStraight(value => !value)}><RotateCcw size={14} aria-hidden="true" />{straight ? "3D view" : "Front view"}</button></div>
  </div>;
}
