import { useState } from "react";
import { motion } from "motion/react";
import {
  Plus,
  CloudOff,
  Lock,
  FileSpreadsheet,
  ShieldOff,
} from "lucide-react";

const items = [
  {
    id: "1",
    icon: CloudOff,
    title: "Does Tally send my data anywhere?",
    content:
      "No. Tally runs entirely in your browser. There is no account, no server, and no analytics. Your transactions never leave this device unless you export a backup yourself.",
  },
  {
    id: "2",
    icon: FileSpreadsheet,
    title: "How do I get my numbers in?",
    content:
      "Import a CSV from your bank, add transactions manually, or try the built-in demo data. Everything is computed locally: balances, categories, subscriptions, and forecasts.",
  },
  {
    id: "3",
    icon: Lock,
    title: "Can I lock my data?",
    content:
      "Yes. Set an optional passphrase and Tally encrypts the whole store with AES-256-GCM. The passphrase never leaves memory, and there is no recovery if you forget it.",
  },
  {
    id: "4",
    icon: ShieldOff,
    title: "Is there any tracking or ads?",
    content:
      "Zero tracking. No cookies for ads, no beacons, no third-party scripts. The privacy promise is enforced in tests: the offline app makes no network calls.",
  },
];

export function FaqAccordion() {
  const [openItem, setOpenItem] = useState<string | null>(null);

  const toggleItem = (id: string) => {
    setOpenItem((current) => (current === id ? null : id));
  };

  return (
    <div
      className="
        w-full max-w-md mx-auto text-left
        bg-white/30 dark:bg-black/30
        backdrop-blur-md
        border border-gray-300 dark:border-gray-700
        rounded-lg
        shadow-lg shadow-black/20 dark:shadow-white/10
        transition-colors duration-500
      "
    >
      <h2 className="text-2xl font-extrabold text-black dark:text-white px-5 pt-5 select-none tracking-tight">
        FAQs
      </h2>

      <div>
        {items.map(({ id, icon: Icon, title, content }) => {
          const isOpen = openItem === id;

          return (
            <div
              key={id}
              className="border-t border-gray-300 dark:border-gray-700 last:border-b-0"
            >
              <button
                type="button"
                onClick={() => toggleItem(id)}
                aria-expanded={isOpen}
                className="
                  flex items-center justify-between w-full
                  px-5 py-4
                  text-black dark:text-white
                  text-base font-medium
                  cursor-pointer
                  bg-transparent
                  transition-colors duration-300
                  hover:bg-black/5 dark:hover:bg-white/10
                  select-none
                  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]
                  text-left
                "
              >
                <div className="flex items-center gap-3 pr-3">
                  <Icon
                    className="w-4 h-4 shrink-0 text-black dark:text-white"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <span>{title}</span>
                </div>

                <Plus
                  className={`w-4 h-4 shrink-0 text-black dark:text-white transition-transform duration-300 ${
                    isOpen ? "rotate-45" : "rotate-0"
                  }`}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </button>

              <motion.div
                initial={false}
                animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                style={{ overflow: "hidden" }}
              >
                <div className="px-5 pb-5 text-gray-700 dark:text-gray-300 text-sm leading-relaxed select-text">
                  {content}
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
