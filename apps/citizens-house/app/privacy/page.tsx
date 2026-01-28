"use client"

import { useState } from "react"
import { StarPattern } from "@/components/verification/icons/star-pattern"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@near-citizens/ui"

const LAST_UPDATED_DATES = {
  privacy: "January 27, 2026",
  "eu-uk": "January 6, 2026",
}

export default function PrivacyPage() {
  const [activeTab, setActiveTab] = useState<"privacy" | "eu-uk">("privacy")

  return (
    <div className="bg-white dark:bg-[#181921]">
      {/* Hero Section - Fixed height with gradient background */}
      <section className="relative h-[320px] md:h-[400px] -mt-32 pt-32 overflow-hidden">
        {/* Yellow gradient background - contained within hero */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_500px_320px_at_center_30%,_rgba(255,218,30,0.4)_0%,_rgba(253,221,57,0.3)_25%,_rgba(249,230,136,0.2)_45%,_rgba(245,236,189,0.14)_60%,_rgba(242,242,242,0.06)_75%,_transparent_100%)] md:bg-[radial-gradient(ellipse_650px_420px_at_center_30%,_rgba(255,218,30,0.4)_0%,_rgba(253,221,57,0.3)_25%,_rgba(249,230,136,0.2)_45%,_rgba(245,236,189,0.14)_60%,_rgba(242,242,242,0.06)_75%,_transparent_100%)] dark:bg-[radial-gradient(ellipse_500px_320px_at_center_30%,_rgba(255,218,30,0.28)_0%,_rgba(253,221,57,0.2)_30%,_rgba(249,230,136,0.14)_55%,_transparent_80%)] md:dark:bg-[radial-gradient(ellipse_650px_420px_at_center_30%,_rgba(255,218,30,0.28)_0%,_rgba(253,221,57,0.2)_30%,_rgba(249,230,136,0.14)_55%,_transparent_80%)]" />
        </div>

        {/* Star pattern - positioned near right edge */}
        <div
          className="absolute top-[100px] md:top-[120px] w-[372px] h-[246px] pointer-events-none z-0"
          style={{
            left: "min(calc(50% + 360px), calc(100% - 200px))",
          }}
        >
          <StarPattern className="w-full h-full text-[#FFDA1E] dark:text-[#FFDA1E]/30" />
        </div>

        {/* Title and Last Updated - centered in hero */}
        <div className="relative flex flex-col gap-[16px] items-center justify-center h-full px-12 md:px-6 z-10">
          <h1 className="text-[36px] leading-[44px] md:text-[62px] md:leading-[72px] font-fk-grotesk font-medium text-black dark:text-white text-center">
            Privacy Policy
          </h1>
          <p className="text-[22px] leading-[30px] font-fk-grotesk font-normal text-black dark:text-white text-center">
            Last updated: {LAST_UPDATED_DATES[activeTab]}
          </p>
        </div>
      </section>

      {/* Content Section with Tabs */}
      <section className="flex justify-center w-full px-6 md:px-0 py-[40px]">
        <div className="flex flex-col gap-[40px] items-start w-full max-w-[1055px]">
          <Tabs
            defaultValue="privacy"
            className="w-full"
            onValueChange={(value: string) => setActiveTab(value as "privacy" | "eu-uk")}
          >
            <TabsList className="w-full sm:w-auto h-auto p-1 bg-[#f1f1f1] dark:bg-[#2a2a2a] rounded-[4px]">
              <TabsTrigger
                value="privacy"
                className="flex-1 sm:flex-none px-6 py-3 text-[14px] md:text-[16px] font-fk-grotesk font-medium rounded-[4px] data-[state=active]:bg-white data-[state=active]:dark:bg-[#181921] data-[state=active]:shadow-sm transition-all"
              >
                Privacy Policy
              </TabsTrigger>
              <TabsTrigger
                value="eu-uk"
                className="flex-1 sm:flex-none px-6 py-3 text-[14px] md:text-[16px] font-fk-grotesk font-medium rounded-[4px] data-[state=active]:bg-white data-[state=active]:dark:bg-[#181921] data-[state=active]:shadow-sm transition-all"
              >
                Privacy Policy EU/UK
              </TabsTrigger>
            </TabsList>

            {/* Privacy Policy Tab Content */}
            <TabsContent value="privacy" className="mt-[40px]">
              <PrivacyPolicyContent />
            </TabsContent>

            {/* EU/UK Privacy Addendum Tab Content */}
            <TabsContent value="eu-uk" className="mt-[40px]">
              <EUUKPrivacyContent />
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  )
}

function PrivacyPolicyContent() {
  return (
    <article className="flex flex-col gap-[32px] items-start w-full">
      {/* Introduction */}
      <section className="flex flex-col gap-[16px] w-full">
        <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
          Introduction
        </h2>
        <div className="flex flex-col gap-[16px] opacity-[0.88]">
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            NEAR Citizen House (&ldquo;Company&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo; or &ldquo;we&rdquo;) respects
            your privacy and is committed to providing you with information about our and our service providers&apos;
            data handling practices through this privacy policy. NEAR Citizen House operates a governance participation
            and identity verification platform designed to enable verified participation in governance processes within
            the NEAR ecosystem.
          </p>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            This privacy policy describes the types of information we and our Services Providers may collect from you or
            that you may provide when you visit our website https://citizenshouse.org/ (the &ldquo;Website&rdquo;), when
            you use any mobile applications to which this policy is posted (collectively, the &ldquo;Apps&rdquo; and
            each, an &ldquo;App&rdquo;), as well as any tools, code or other software made available for download on the
            Website or the Apps (collectively, the &ldquo;Tools&rdquo;). For clarity, &ldquo;Apps&rdquo; and
            &ldquo;Tools&rdquo; refer only to applications and tools, if any, that are operated by NEAR Citizen House
            and that link to or reference this Privacy Policy.
          </p>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            This privacy policy is part of the Terms of Use applicable to the use of the Website and any related
            applications or tools operated by NEAR Citizen House. Please review this policy together with the Terms of
            Use, to understand all of your rights and obligations, and how we operate the Website, the Apps and the
            Tools.
          </p>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            All capitalized terms not otherwise defined in this privacy policy shall have the meanings ascribed to them
            in the Terms of Use.
          </p>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            By using the Website and any related applications or tools operated by NEAR Citizen House, you accept and
            agree to be bound and abide by this privacy policy and the Terms of Use. If you do not want to agree to this
            privacy policy or the Terms of Use, you must not access or use the Website and any related applications or
            tools.
          </p>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            This privacy policy applies to information we and/or our service providers collect:
          </p>
          <ul className="list-disc pl-6 flex flex-col gap-[8px]">
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Through visiting or using the Website and any related applications or tools operated by NEAR Citizen
              House;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              In electronic messages between you and the Website;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Through mobile and desktop applications, if any, that you download from the Website or the Apps, or
              relating to the Tools, if this policy is posted to them;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Through any other means associated with or relating to the Website, the Apps and the Tools.
            </li>
          </ul>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            This policy does not apply to information collected by:
          </p>
          <ul className="list-disc pl-6 flex flex-col gap-[8px]">
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Us or our service providers offline or through any other means, including on any other website or apps
              operated by Company or any third party (including our respective affiliates, subsidiaries and service
              providers); or
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Any third party not operated or controlled by NEAR Citizen House, including third-party websites,
              applications, or services, even if linked from the Website.
            </li>
          </ul>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            Please read this policy carefully to understand our policies and practices regarding your information and
            how we will treat it. If you do not agree with our policies and practices, your choice is not to use the
            Website, the Apps and the Tools. By accessing or using the Website, the Apps and the Tools, you agree to the
            terms of this privacy policy.
          </p>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            This privacy policy may change from time to time. Your continued use of the Website, the Apps and the Tools
            after we make changes is deemed to be acceptance of those changes, so please check the privacy policy
            periodically for updates.
          </p>
        </div>
      </section>

      {/* Children under the Age of Sixteen */}
      <section className="flex flex-col gap-[16px] w-full">
        <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
          Children under the Age of Sixteen (16)
        </h2>
        <div className="flex flex-col gap-[16px] opacity-[0.88]">
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            The Website, the Apps and the Tools are not intended for children under sixteen (16) years of age. No one
            under age sixteen (16) may provide any personal information to us or our service providers or on or through
            the Website, the Apps and the Tools. We and our service providers do not knowingly or intentionally collect
            personal information from children under the age of sixteen (16). If you are under sixteen (16), do not use
            or provide any information on or through the Website, the Apps and the Tools, or register on the Website,
            the Apps, or the Tools, or use any of the interactive or public comment features of this Website, the Apps
            or the Tools or provide any information about yourself to us or our service providers, including your name,
            address, telephone number, email address, or any screen name or user name you may use.
          </p>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            If we or our service providers learn we have collected or received personal information from a child under
            sixteen (16) years of age, we will delete that information. If you believe we or our service providers might
            have any information from or about a child under the age of sixteen (16), please report this information at
            info@citizenshouse.org
          </p>
        </div>
      </section>

      {/* Information We and Our Service Providers MAY Collect */}
      <section className="flex flex-col gap-[16px] w-full">
        <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
          Information We and Our Service Providers MAY Collect About You and How We Collect It
        </h2>
        <div className="flex flex-col gap-[16px] opacity-[0.88]">
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            We and our service providers may collect several types of information from and about users of the Website,
            the Apps and the Tools (some of which is considered &ldquo;personal information&rdquo; pursuant to
            applicable law), including:
          </p>
          <ul className="list-disc pl-6 flex flex-col gap-[8px]">
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Identifiers, such as name, mailing address, e-mail address, telephone number, company information, or any
              other information that the Website, the Apps and the Tools collect, which applicable law may consider
              personally identifiable, personal information, personal data, and other such designations;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Information about the device you use to access the Website, the Apps and the Tools;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Your IP address, International Mobile Equipment Identity (&ldquo;IMEI&rdquo;), or another unique
              identifier;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Your device characteristics and functionality (including information about your operating system,
              hardware, mobile network, browser, browser language, etc.);
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Referring and exit web pages and URLs;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Your browsing history, including the areas within the Website, the Apps and the Tools that you visit and
              your activities there, including remembering you and your preferences;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Your device location or other geolocation information;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Certain other device data, including the time of day you visit the Website, the Apps and the Tools; and
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Information about your internet connection and internet provider.
            </li>
          </ul>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            We and our service providers collect this information:
          </p>
          <ul className="list-disc pl-6 flex flex-col gap-[8px]">
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Directly from you when you provide it to us, such as when filling in forms on the Website, the Apps and
              the Tools (including when you register for an account, subscribing to a service, or requesting something
              from us or our service providers, or when you fill out surveys, if any such features are available to
              you).
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Automatically as you navigate through the Website, the Apps and the Tools, including through the use of
              cookies, web beacons, and other tracking technologies (including information about your network or
              computing device) and analytics services;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              From third parties, for example, our respective business partners and service providers;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Records and copies of your correspondence (including email addresses), if you contact us through the
              Website and the Apps, or our service providers through the Tools;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              When you run searches on the Website, the Apps and the Tools; and
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              When you contact our or our service providers&apos; customer service agents, if available.
            </li>
          </ul>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            NEAR Citizen House does not collect or store copies of passports, raw biometric identifiers, or passport
            chip data. Identity verification is performed by a third-party provider as described below.
          </p>
        </div>
      </section>

      {/* Identity Verification Information */}
      <section className="flex flex-col gap-[16px] w-full">
        <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
          Identity Verification Information
        </h2>
        <div className="flex flex-col gap-[16px] opacity-[0.88]">
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            NEAR Citizen House uses a third-party identity verification provider to enable users to prove that they are
            a unique human being for governance participation.
          </p>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            Identity verification may involve scanning a passport or other biometric identity document using a
            third-party mobile application. This process generates a cryptographic or zero-knowledge proof confirming
            identity attributes without revealing or storing the underlying document.
          </p>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            NEAR Citizen House does not receive, store, or process raw biometric data or passport images. Users are
            subject to the privacy policy of the third-party identity verification provider when completing identity
            verification.
          </p>
        </div>
      </section>

      {/* Automatic Data Collection Technologies */}
      <section className="flex flex-col gap-[16px] w-full">
        <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
          Automatic Data Collection Technologies
        </h2>
        <div className="flex flex-col gap-[16px] opacity-[0.88]">
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            As you navigate through and interact with the Website, the Apps and the Tools, we and our service providers
            may use automatic data collection technologies to collect certain information about you, your equipment,
            your technology providers, and your activities, including:
          </p>
          <ul className="list-disc pl-6 flex flex-col gap-[8px]">
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Details of your visits to the Website, the Apps and the Tools, including traffic data, browsing patterns,
              location data, logs, and other communication data and the resources that you access and use on the
              Website, the Apps and the Tools; and
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Information about your device and about your internet connection and service provider, as set forth above.
            </li>
          </ul>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            We and our service providers also may use these technologies to collect information about your online
            activities over time and across third-party websites or other online services (behavioral tracking).
          </p>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            The information we and our service providers collect automatically may be statistical data and may also
            include personal information, or we and our service providers may maintain it or associate it with personal
            information we each collect in other ways or receive from third parties. This information enables us and our
            service providers to:
          </p>
          <ul className="list-disc pl-6 flex flex-col gap-[8px]">
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Allow you to use and access the Website, the Apps and the Tools;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Prevent fraudulent activity and improve security functionality;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Assess the performance of the Website, the Apps and the Tools, including as part of our and our service
              providers&apos; analytic practices or otherwise to improve the content, products or services offered
              through the Website, the Apps and the Tools;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Offer you enhanced functionality when accessing the Website, the Apps and the Tools, including identifying
              you when you sign into the Website, the Apps and the Tools, and keeping track of your specified
              preferences;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Maintain the security and integrity of the Website and related governance verification features;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Estimate our and our service providers&apos; audience size and usage patterns;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Speed up your searches; and
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Analyze usage trends to maintain and improve the Website&apos;s functionality and reliability.
            </li>
          </ul>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            When you visit or leave the Website, the Apps and the Tools by clicking a hyperlink or when you view a
            third-party site that includes our and our service providers&apos; plugins or cookies (or similar
            technology), we and our service providers may automatically receive the URL of the site from which you came
            or the one to which you are directed.
          </p>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            We and our service providers may also receive location data passed to each of us from third-party services
            or GPS-enabled devices that you have set up, which we and our service providers may use to show you local
            information when using the Website, the Apps and the Tools, and for fraud prevention and security purposes.
            We and our service providers may use this information to provide customized services, content, and other
            information that may be of interest to you. If you no longer wish for us, our affiliates, or our service
            providers to collect and use location information, you may disable the location features on your device.
            Consult your device manufacturer settings for instructions on how to do this. Please note that if you
            disable such features, your ability to access certain features, services, content, or products may be
            limited or disabled.
          </p>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            The technologies we and our service providers use for this automatic data collection may include:
          </p>
          <ul className="list-disc pl-6 flex flex-col gap-[8px]">
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              <strong>Cookies (or browser cookies).</strong> Cookies are small text files stored through a browser on a
              computing or mobile device. Cookies help you navigate website pages efficiently and may improve your user
              experience. Note that while you can set your browser to not allow cookies, we and our service providers
              may not be able to honor that request, and may track your activity and collect information about you and
              your online activities even when the browser is set to &ldquo;do not track&rdquo;;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              <strong>Web Beacons, Pixels and Tags.</strong> Pages of the Website, the Apps and the Tools, and our and
              our service providers&apos; e-mails, may contain small electronic files known as web beacons (also
              referred to as clear gifs, pixel tags, and single-pixel gifs) that permit us and our service providers,
              for example, to count users who have visited those pages or opened an email and for other related website
              statistics (for example, recording the popularity of certain content and verifying system and server
              integrity);
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              <strong>Embedded Scripts.</strong> An embedded script is programming code that is designed to collect
              information about your interactions with the Website, the Apps and the Tools, such as information about
              the links you click on;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              <strong>ETag, or entity tag.</strong> An ETag, or entity tag, is a feature of the cache in browsers. It is
              an opaque identifier assigned by a web server to a specific version of a resource found at a URL. It is
              one of several mechanisms that HTTP provides for web cache validation. These allow websites to be more
              efficient and not serve content again, when data is already cached and ready to view; and
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              <strong>Log Files.</strong> These track actions occurring on the Website, the Apps and the Tools, which
              help us and our service providers collect your IP address, browser type, Internet service provider, the
              webpages from which you came or to which you go before and after visiting the Website, the Apps and the
              Tools, and the date and time of your visits.
            </li>
          </ul>
        </div>
      </section>

      {/* Do Not Track */}
      <section className="flex flex-col gap-[16px] w-full">
        <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
          Do Not Track
        </h2>
        <div className="flex flex-col gap-[16px] opacity-[0.88]">
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            Do Not Track (&ldquo;DNT&rdquo;) is a concept promoted by certain regulatory authorities and industry groups
            for development and implementation of a mechanism that would allow internet users to control the tracking of
            their online activities across websites. Currently, various browsers (including Internet Explorer, Firefox,
            and Safari) offer a DNT option that allows a user to set a preference in the browser to not have his/her
            activities on the internet tracked. You can usually access your browser&apos;s DNT option in your
            browser&apos;s preferences. When a user&apos;s browser is set to DNT, some cookies and other tracking
            technologies may become inactive, depending on how the website visited responds to DNT browser settings. If
            that occurs, the website visited will not recognize you upon return to that website, save your passwords or
            user names, and some other features of a website may become unavailable or not function properly.
          </p>
        </div>
      </section>

      {/* Third-Party Use of Cookies */}
      <section className="flex flex-col gap-[16px] w-full">
        <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
          Third-Party Use of Cookies and Other Tracking Technologies
        </h2>
        <div className="flex flex-col gap-[16px] opacity-[0.88]">
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            Some content or applications on the Website, the Apps and the Tools may be served by third parties,
            including content delivery providers, analytics providers, and application service providers. These third
            parties may use cookies or similar tracking technologies to collect information about your use of the
            Website, the Apps and the Tools in accordance with their own privacy policies.
          </p>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            We and our service providers do not control these third parties&apos; tracking technologies or how they may
            be used.
          </p>
        </div>
      </section>

      {/* Your Choices and Rights */}
      <section className="flex flex-col gap-[16px] w-full">
        <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
          Your Choices and Rights
        </h2>
        <div className="flex flex-col gap-[16px] opacity-[0.88]">
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            You may request access to, correction of, or deletion of certain personal information we maintain about you
            by contacting us at info@citizenshouse.org. We may need to verify your identity before responding to your
            request. Please note that we may retain certain information as required or permitted by law, for security
            purposes, and to maintain the integrity of the Website and related governance verification features.
          </p>
        </div>
      </section>

      {/* How We and Our Service Providers Use Your Information */}
      <section className="flex flex-col gap-[16px] w-full">
        <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
          How We and Our Service Providers Use Your Information
        </h2>
        <div className="flex flex-col gap-[16px] opacity-[0.88]">
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            We and our service providers may use information that we each collect about you or that you provide to each
            of us or on the Website, the Apps and the Tools, including any personal information:
          </p>
          <ul className="list-disc pl-6 flex flex-col gap-[8px]">
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              To present the Website, the Apps and the Tools and their contents to you;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              To provide you with information, products, or services that you request from us and our service providers;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              To provide you with notices about your account, the Website, the Apps and/or the Tools;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              To carry out our and our service providers&apos; obligations and enforce our respective rights arising
              from any contracts entered into between you and each of us, including for billing and collection, if
              needed;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              To notify you about changes to the Website, the Apps and the Tools or any products or services we or our
              service providers offer or provide though them;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              To allow you to participate in interactive features on the Website, the Apps and the Tools, if any;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              To develop and improve our and our service providers&apos; products and services;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              For other purposes that are compatible with the purposes described in this Privacy Policy, or with your
              consent;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              For any other purpose with your consent;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              To send you service-related or governance-related communications; and
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              To comply with applicable laws, regulations, and contractual obligations.
            </li>
          </ul>
        </div>
      </section>

      {/* Disclosure of Your Information */}
      <section className="flex flex-col gap-[16px] w-full">
        <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
          Disclosure of Your Information
        </h2>
        <div className="flex flex-col gap-[16px] opacity-[0.88]">
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            We and our service providers may disclose aggregated information about users, and information that does not
            identify any individual, without restriction.
          </p>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            We and our service providers may disclose personal information that we each collect or you provide as
            described in this privacy policy:
          </p>
          <ul className="list-disc pl-6 flex flex-col gap-[8px]">
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              To our and our service providers&apos; affiliates;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              To contractors, service providers (in addition to the service providers that provide the Tools), and other
              third parties we each use to support our respective businesses and assist in providing services and
              offering products;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              To a buyer or other successor in the event of a merger, divestiture, restructuring, reorganization,
              dissolution, or other sale or transfer of some or all of our or our service providers&apos; assets or
              stock, whether as a going concern or as part of bankruptcy, liquidation, or similar proceeding, in which
              personal information held by us or our service providers about the users of the Website, the Apps and/or
              the Tools is among the assets transferred;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              To fulfill the purpose for which you provide it;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              For any other purpose disclosed by us or our service providers when you provide the information; and
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              With your consent.
            </li>
          </ul>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            We and our service providers may also disclose your personal information:
          </p>
          <ul className="list-disc pl-6 flex flex-col gap-[8px]">
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              To comply with any court order, law, or legal process, including responding to any government, law
              enforcement, or regulatory request under any applicable laws, regulations, legal processes, or government
              requests;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              To enforce or apply the Terms of Use, including this Privacy Policy, and any other agreements between you
              and us or you and our service providers, including for billing and collection purposes; and
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              If we or our service providers believe disclosure is necessary or appropriate to protect the rights,
              property, or safety of us, our service providers, our customers, or others. This includes exchanging
              information with other companies and organizations for the purposes of fraud protection and credit risk
              reduction.
            </li>
          </ul>
        </div>
      </section>

      {/* Data Security */}
      <section className="flex flex-col gap-[16px] w-full">
        <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
          Data Security
        </h2>
        <div className="flex flex-col gap-[16px] opacity-[0.88]">
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            We and our service providers have implemented measures intended to secure your personal information from
            accidental loss and from unauthorized access, use, alteration, and disclosure. However, the safety and
            security of your information also depends on you. Where we or our service providers have given you (or where
            you have chosen) a password for access to certain parts of the Website, the Apps and the Tools, you are
            responsible for keeping this password confidential. We and our service providers ask you not to share your
            password with anyone and to change your password from time to time. We and our service providers also highly
            recommend that you use a password that is dissimilar to and cannot be easily found by unauthorized third
            parties who may have obtained your login credentials to other sites. Keep in mind that if you use the same
            password for all websites, if someone obtains your credentials for one site, they may be able to then use
            those credentials to log into any other site you use.
          </p>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            Unfortunately, the transmission of information via the internet is not completely secure. Although we and
            our service providers try to protect your personal information, we and our service providers cannot
            guarantee the security of your personal information transmitted through or collected through the use of the
            Website, the Apps and the Tools. Any transmission of personal information is at your own risk.
          </p>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            We and our service providers are not responsible for circumvention of any privacy settings or security
            measures contained on the Website, the Apps and the Tools.
          </p>
        </div>
      </section>

      {/* Data Retention */}
      <section className="flex flex-col gap-[16px] w-full">
        <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
          Data Retention
        </h2>
        <div className="flex flex-col gap-[16px] opacity-[0.88]">
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            We retain personal information only for as long as reasonably necessary to fulfill the purposes described in
            this Privacy Policy, including to operate the Website, maintain security, prevent fraud, comply with legal
            obligations, and resolve disputes. When we no longer need personal information, we will delete or
            de-identify it in accordance with applicable law and our retention practices.
          </p>
        </div>
      </section>

      {/* Changes to This Privacy Policy */}
      <section className="flex flex-col gap-[16px] w-full">
        <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
          Changes to This Privacy Policy
        </h2>
        <div className="flex flex-col gap-[16px] opacity-[0.88]">
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            It is our policy to post any changes made to the privacy policy on this page. When changes are made, we will
            post a revised version on our Website with the last updated and effective date posted on the top of this
            page.
          </p>
        </div>
      </section>

      {/* Contact Information */}
      <section className="flex flex-col gap-[16px] w-full">
        <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
          Contact Information
        </h2>
        <div className="flex flex-col gap-[16px] opacity-[0.88]">
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            EU/UK users should also review the European Union &amp; United Kingdom Privacy Addendum.
          </p>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            To ask questions or comment about this privacy policy and our privacy practices, please direct such
            inquiries to:
          </p>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            E-mail: info@citizenshouse.org
          </p>
        </div>
      </section>
    </article>
  )
}

function EUUKPrivacyContent() {
  return (
    <article className="flex flex-col gap-[32px] items-start w-full">
      {/* Scope and Applicability */}
      <section className="flex flex-col gap-[16px] w-full">
        <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
          Scope and Applicability
        </h2>
        <div className="flex flex-col gap-[16px] opacity-[0.88]">
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            This European Union and United Kingdom Privacy Addendum (&ldquo;EU/UK Addendum&rdquo;) to this Privacy
            Policy applies only to individuals who access or use the NEAR Citizen House website, applications, or
            related tools (collectively, the &ldquo;Services&rdquo;) from the European Economic Area
            (&ldquo;EEA&rdquo;), Switzerland, or the United Kingdom.
          </p>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            This EU/UK Addendum supplements the NEAR Citizen House Privacy Policy and applies solely to the processing
            of personal data subject to the EU General Data Protection Regulation (&ldquo;GDPR&rdquo;) and the UK GDPR.
            In the event of a conflict, this Addendum controls for EU/UK users.
          </p>
        </div>
      </section>

      {/* Data Controller */}
      <section className="flex flex-col gap-[16px] w-full">
        <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
          Data Controller
        </h2>
        <div className="flex flex-col gap-[16px] opacity-[0.88]">
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            For purposes of the GDPR and UK GDPR, NEAR Citizen House is the data controller with respect to personal
            data processed through the Services.
          </p>
        </div>
      </section>

      {/* Categories of Personal Data Processed */}
      <section className="flex flex-col gap-[16px] w-full">
        <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
          Categories of Personal Data Processed
        </h2>
        <div className="flex flex-col gap-[16px] opacity-[0.88]">
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            As described in the main Privacy Policy, NEAR Citizen House processes limited categories of personal data,
            which may include:
          </p>
          <ul className="list-disc pl-6 flex flex-col gap-[8px]">
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Identifiers and contact information, such as email address or wallet-related identifiers (where provided);
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Technical data, such as IP address, device type, browser information, and usage logs;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Usage data, including interactions with the Services;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Governance participation data, such as verification status or eligibility indicators.
            </li>
          </ul>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            <strong>Important clarification:</strong> NEAR Citizen House does not collect or store copies of passports,
            raw biometric identifiers, biometric templates, or passport chip data. Identity verification is performed by
            a third-party provider, and NEAR Citizen House receives only confirmation or cryptographic proof of
            verification status.
          </p>
        </div>
      </section>

      {/* Source of Personal Data */}
      <section className="flex flex-col gap-[16px] w-full">
        <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
          Source of Personal Data
        </h2>
        <div className="flex flex-col gap-[16px] opacity-[0.88]">
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            Personal data is collected directly from you when you interact with the Services, and automatically through
            your use of the Services. Limited verification-related information may also be received from third-party
            identity verification providers in the form of confirmation or cryptographic proof.
          </p>
        </div>
      </section>

      {/* Lawful Bases for Processing */}
      <section className="flex flex-col gap-[16px] w-full">
        <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
          Lawful Bases for Processing
        </h2>
        <div className="flex flex-col gap-[16px] opacity-[0.88]">
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            We process personal data only where permitted under applicable data protection law. Our lawful bases
            include:
          </p>
          <ul className="list-disc pl-6 flex flex-col gap-[8px]">
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              <strong>Performance of a contract</strong> &ndash; where processing is necessary to provide access to the
              Services you request;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              <strong>Legitimate interests</strong> &ndash; including maintaining platform security, preventing fraud,
              ensuring governance integrity, and improving the reliability of the Services, where such interests are not
              overridden by your rights;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              <strong>Legal obligations</strong> &ndash; where processing is required to comply with applicable laws or
              regulatory requirements; and
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              <strong>Consent</strong> &ndash; where required by law, which you may withdraw at any time.
            </li>
          </ul>
        </div>
      </section>

      {/* How Personal Data Is Used */}
      <section className="flex flex-col gap-[16px] w-full">
        <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
          How Personal Data Is Used
        </h2>
        <div className="flex flex-col gap-[16px] opacity-[0.88]">
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            Personal data is processed for purposes consistent with those described in the main Privacy Policy,
            including:
          </p>
          <ul className="list-disc pl-6 flex flex-col gap-[8px]">
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Providing and operating the Services;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Enabling governance participation and verification features;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Maintaining security, preventing abuse or fraud, and protecting the integrity of the platform;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Monitoring and improving system performance and reliability; and
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Complying with legal and regulatory obligations.
            </li>
          </ul>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            NEAR Citizen House does not use personal data for behavioral advertising or commercial profiling.
          </p>
        </div>
      </section>

      {/* Automated Decision-Making */}
      <section className="flex flex-col gap-[16px] w-full">
        <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
          Automated Decision-Making
        </h2>
        <div className="flex flex-col gap-[16px] opacity-[0.88]">
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            NEAR Citizen House does not engage in automated decision-making or profiling that produces legal or
            similarly significant effects on individuals within the meaning of Article 22 of the GDPR.
          </p>
        </div>
      </section>

      {/* Data Subject Rights */}
      <section className="flex flex-col gap-[16px] w-full">
        <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
          Data Subject Rights (EU &amp; UK)
        </h2>
        <div className="flex flex-col gap-[16px] opacity-[0.88]">
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            Subject to applicable law, individuals in the EU and UK have the right to:
          </p>
          <ul className="list-disc pl-6 flex flex-col gap-[8px]">
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Request access to their personal data;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Request correction of inaccurate or incomplete personal data;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Request deletion of personal data;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Request restriction of processing;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Object to processing based on legitimate interests;
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Request portability of personal data; and
            </li>
            <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
              Withdraw consent where processing is based on consent.
            </li>
          </ul>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            Requests may be submitted by contacting us at info@citizenshouse.org.
          </p>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            We may request additional information to verify your identity before responding. Where processing is based
            on consent, you may withdraw your consent at any time by contacting us, without affecting the lawfulness of
            processing carried out prior to withdrawal. We aim to respond to verified requests within one month, unless
            a longer period is permitted under applicable law.
          </p>
        </div>
      </section>

      {/* International Data Transfers */}
      <section className="flex flex-col gap-[16px] w-full">
        <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
          International Data Transfers
        </h2>
        <div className="flex flex-col gap-[16px] opacity-[0.88]">
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            Your personal data may be transferred to and processed in countries outside the EEA or the UK. Where such
            transfers occur, we implement appropriate safeguards to ensure an adequate level of protection in accordance
            with applicable data protection laws, such as reliance on adequacy decisions or standard contractual
            safeguards.
          </p>
        </div>
      </section>

      {/* Data Retention */}
      <section className="flex flex-col gap-[16px] w-full">
        <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
          Data Retention
        </h2>
        <div className="flex flex-col gap-[16px] opacity-[0.88]">
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            We retain personal data only for as long as reasonably necessary to fulfill the purposes described in the
            Privacy Policy and this Addendum, including for security, fraud prevention, compliance with legal
            obligations, and dispute resolution.
          </p>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            Where possible, data is deleted or anonymized when no longer required.
          </p>
        </div>
      </section>

      {/* Supervisory Authority */}
      <section className="flex flex-col gap-[16px] w-full">
        <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
          Supervisory Authority
        </h2>
        <div className="flex flex-col gap-[16px] opacity-[0.88]">
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            If you are located in the EU or the UK, you have the right to lodge a complaint with your local data
            protection supervisory authority if you believe that our processing of your personal data violates
            applicable law.
          </p>
        </div>
      </section>

      {/* Contact Information */}
      <section className="flex flex-col gap-[16px] w-full">
        <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
          Contact Information
        </h2>
        <div className="flex flex-col gap-[16px] opacity-[0.88]">
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            For questions, concerns, or to exercise your EU/UK data protection rights, please contact:
          </p>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            Email: info@citizenshouse.org
          </p>
          <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
            Subject line: &ldquo;EU/UK Privacy Rights &ndash; NEAR Citizen House&rdquo;
          </p>
        </div>
      </section>
    </article>
  )
}
