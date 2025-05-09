"use client";

import { APP_VERSION } from "@/version";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

export default function Nav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => {
    setMenuOpen((prev) => !prev);
  };
  
  // Function to close the menu
  const closeMenu = () => {
    setMenuOpen(false);
  };

  const linkClass = (href: string) =>
    `block py-2 px-3 rounded-sm md:p-0 ${
      pathname === href
        ? "text-blue-400 md:text-blue-400"
        : "text-white hover:text-gray-300 md:hover:text-blue-400"
    }`;

  return (
    <nav className="bg-gray-900">
      <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
        <Link
          href="/"
          className="text-2xl font-semibold whitespace-nowrap text-white"
          onClick={closeMenu}
        >
          DVB Ble Scanner v{APP_VERSION}
        </Link>
        
        <button
          onClick={toggleMenu}
          type="button"
          className="inline-flex items-center p-2 w-10 h-10 justify-center text-sm text-gray-400 rounded-lg md:hidden hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
          aria-controls="navbar-default"
          aria-expanded={menuOpen}
        >
          <span className="sr-only">Open main menu</span>
          <svg
            className="w-5 h-5"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 17 14"
          >
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M1 1h15M1 7h15M1 13h15"
            />
          </svg>
        </button>
        
        <div className={`${menuOpen ? 'block' : 'hidden'} w-full md:block md:w-auto`} id="navbar-default">
          <ul className="font-medium flex flex-col p-4 md:p-0 mt-4 rounded-lg bg-gray-800 md:flex-row md:space-x-8 rtl:space-x-reverse md:mt-0 md:border-0 md:bg-transparent">
            <li>
              <Link href="/transfer" className={linkClass("/transfer")} onClick={closeMenu}>
                Transfer
              </Link>
            </li>
            <li>
              <Link href="/firmware" className={linkClass("/firmware")} onClick={closeMenu}>
                Firmware
              </Link>
            </li>
            <li>
              <Link href="/production" className={linkClass("/production")} onClick={closeMenu}>
                Production
              </Link>
            </li> 
            <li>
              <Link href="/parser" className={linkClass("/parser")} onClick={closeMenu}>
                Parser
              </Link>
            </li> 
          </ul>
        </div>
      </div>
    </nav>
  );
}