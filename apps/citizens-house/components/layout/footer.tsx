import Link from "next/link"

export function Footer() {
  return (
    <footer className="flex flex-col bg-white dark:bg-[#191a23]">
      {/* Desktop Footer - Main Links Section */}
      <div className="hidden md:flex items-end justify-between p-[80px] border-t border-[rgba(0,0,0,0.1)] dark:border-[#2a2c3b]">
        {/* Left side - intentionally empty for spacing in Figma design */}
        <div className="shrink-0" />

        {/* Right side - Links */}
        <div className="flex items-center gap-[24px]">
          <div className="flex items-center gap-[11px]">
            <Link
              href="/citizens"
              className="text-[16px] leading-[28px] text-black dark:text-white hover:opacity-70 transition-opacity font-fk-grotesk"
            >
              Citizens
            </Link>
            <span className="text-[14px] leading-[1.2] text-[#040404] dark:text-white tracking-[0.14px]">•</span>
            <Link
              href="/support"
              className="text-[16px] leading-[28px] text-black dark:text-white hover:opacity-70 transition-opacity font-fk-grotesk"
            >
              Support
            </Link>
            <span className="text-[14px] leading-[1.2] text-[#040404] dark:text-white tracking-[0.14px]">•</span>
            <Link
              href="/terms"
              className="text-[16px] leading-[28px] text-black dark:text-white hover:opacity-70 transition-opacity font-fk-grotesk"
            >
              Terms of Use
            </Link>
            <span className="text-[14px] leading-[1.2] text-[#040404] dark:text-white tracking-[0.14px]">•</span>
            <Link
              href="/privacy"
              className="text-[16px] leading-[28px] text-black dark:text-white hover:opacity-70 transition-opacity font-fk-grotesk"
            >
              Privacy Policy
            </Link>
            <span className="text-[14px] leading-[1.2] text-[#040404] dark:text-white tracking-[0.14px]">•</span>
            <a
              href="https://hackhumanity.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[16px] leading-[28px] text-black dark:text-white hover:opacity-70 transition-opacity font-fk-grotesk"
            >
              Built by HackHumanity
            </a>
          </div>
          <span className="text-[14px] leading-[1.2] text-[#040404] dark:text-white tracking-[0.14px]">•</span>
          <a
            href="https://github.com/HackHumanityOrg/near-citizens-house"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-70 transition-opacity"
            aria-label="GitHub"
          >
            <svg
              width="24"
              height="24"
              role="img"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              className="fill-[#040404] dark:fill-white"
            >
              <title>GitHub</title>
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
          </a>
        </div>
      </div>

      {/* Desktop Footer - Copyright Section */}
      <div className="hidden md:flex items-center justify-between px-[80px] py-[24px] border-t border-[rgba(0,0,0,0.1)] dark:border-[#2a2c3b]">
        <p className="text-[14px] leading-[14px] text-[#8e8e93] dark:text-[#b3b3b3] font-fk-grotesk">
          © {new Date().getFullYear()} Hack Humanity.{" "}
          <a
            href="https://github.com/HackHumanityOrg/near-citizens-house/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:opacity-70 transition-opacity"
          >
            MIT License
          </a>
        </p>
      </div>

      {/* Mobile Footer - Links */}
      <div className="flex md:hidden flex-col items-end p-[24px] border-t border-[rgba(0,0,0,0.1)] dark:border-[#2a2c3b]">
        <div className="flex flex-col gap-[32px] items-end">
          <Link
            href="/citizens"
            className="text-[16px] leading-[28px] text-black dark:text-white hover:opacity-70 transition-opacity font-fk-grotesk text-right"
          >
            Citizens
          </Link>
          <Link
            href="/support"
            className="text-[16px] leading-[28px] text-black dark:text-white hover:opacity-70 transition-opacity font-fk-grotesk text-right"
          >
            Support
          </Link>
          <Link
            href="/terms"
            className="text-[16px] leading-[28px] text-black dark:text-white hover:opacity-70 transition-opacity font-fk-grotesk text-right"
          >
            Terms of Use
          </Link>
          <Link
            href="/privacy"
            className="text-[16px] leading-[28px] text-black dark:text-white hover:opacity-70 transition-opacity font-fk-grotesk text-right"
          >
            Privacy Policy
          </Link>
          <a
            href="https://hackhumanity.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[16px] leading-[28px] text-black dark:text-white hover:opacity-70 transition-opacity font-fk-grotesk text-right"
          >
            Built by HackHumanity
          </a>
          <a
            href="https://github.com/HackHumanityOrg/near-citizens-house"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-70 transition-opacity"
            aria-label="GitHub"
          >
            <svg
              width="24"
              height="24"
              role="img"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              className="fill-[#040404] dark:fill-white"
            >
              <title>GitHub</title>
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
          </a>
        </div>
      </div>

      {/* Mobile Footer - Copyright */}
      <div className="flex md:hidden items-center justify-start px-[24px] py-[24px] border-t border-[rgba(0,0,0,0.1)] dark:border-[#2a2c3b]">
        <p className="text-[14px] leading-[14px] text-[#8e8e93] dark:text-[#b3b3b3] font-fk-grotesk">
          © {new Date().getFullYear()} Hack Humanity.{" "}
          <a
            href="https://github.com/HackHumanityOrg/near-citizens-house/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:opacity-70 transition-opacity"
          >
            MIT License
          </a>
        </p>
      </div>
    </footer>
  )
}
