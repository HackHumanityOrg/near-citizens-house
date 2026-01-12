import { StarPattern } from "@/components/verification/icons/star-pattern"

export default function TermsPage() {
  return (
    <div className="bg-white dark:bg-[#181921]">
      {/* Hero Section - Fixed height with gradient background */}
      <section className="relative h-[280px] md:h-[400px] -mt-32 pt-32 overflow-hidden">
        {/* Yellow gradient background - contained within hero */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_1200px_800px_at_center_center,_rgba(255,218,30,0.5)_0%,_rgba(253,221,57,0.4)_20%,_rgba(249,230,136,0.3)_40%,_rgba(245,236,189,0.15)_60%,_rgba(242,242,242,0.05)_80%,_transparent_100%)] dark:bg-[radial-gradient(ellipse_1200px_800px_at_center_center,_rgba(255,218,30,0.3)_0%,_rgba(253,221,57,0.2)_20%,_rgba(249,230,136,0.15)_40%,_transparent_70%)]" />
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
        <div className="relative flex flex-col gap-[16px] items-center justify-center h-full px-6 z-10">
          <h1 className="text-[30px] leading-[36px] md:text-[62px] md:leading-[72px] font-fk-grotesk font-medium text-black dark:text-white text-center">
            Terms of Use
          </h1>
          <p className="text-[20px] leading-[1.4] font-fk-grotesk font-normal text-black dark:text-white text-center">
            Last updated: January 7, 2026
          </p>
        </div>
      </section>

      {/* Content Section - White background */}
      <section className="flex justify-center w-full px-6 md:px-0 py-[40px] md:py-[80px]">
        <article className="flex flex-col gap-[32px] items-start w-full max-w-[1055px]">
          {/* 1. Acceptance of Terms */}
          <section className="flex flex-col gap-[16px] w-full">
            <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
              1. Acceptance of Terms
            </h2>
            <div className="flex flex-col gap-[16px] opacity-[0.88]">
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                Welcome to NEAR Citizen House (&ldquo;NEAR Citizen House&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;), an initiative operated by NEAR Foundation (&ldquo;Operator&rdquo;).
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                These Terms of Use (&ldquo;Terms&rdquo;) govern your access to and use of the NEAR Citizen House website located at https://citizenshouse.org and any related applications, interfaces, or tools operated by NEAR Citizen House (collectively, the &ldquo;Services&rdquo;).
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                By accessing, browsing, or using the Services, or by clicking &ldquo;accept&rdquo; where presented, you confirm that you have read, understood, and agree to be bound by these Terms and by our Privacy Policy, which is incorporated by reference. If you do not agree, you must not access or use the Services.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                If you do not meet the eligibility requirements in Section 2, you are expressly prohibited from using the Services.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                <strong>IMPORTANT NOTICE REGARDING DISPUTE RESOLUTION:</strong> These Terms contain a binding arbitration provision and a waiver of class actions and jury trials. By using the Services, you agree that disputes will be resolved on an individual basis through arbitration, as described in Section 15.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                <strong>Definitions:</strong>
              </p>
              <ul className="list-disc pl-6 flex flex-col gap-[8px]">
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  &ldquo;Verification Provider&rdquo; means any independent third-party service used to perform identity or uniqueness verification.
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  &ldquo;Verification Status&rdquo; means a determination, confirmation, or proof generated by a Verification Provider indicating whether a user has satisfied applicable verification requirements at a given time.
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  &ldquo;NEAR Ecosystem&rdquo; means the NEAR Protocol, its governance bodies, smart contracts, and related community or protocol-level processes.
                </li>
              </ul>
            </div>
          </section>

          {/* 2. Eligibility */}
          <section className="flex flex-col gap-[16px] w-full">
            <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
              2. Eligibility
            </h2>
            <div className="flex flex-col gap-[16px] opacity-[0.88]">
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                By using the Services, you represent and warrant that you:
              </p>
              <ul className="list-disc pl-6 flex flex-col gap-[8px]">
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Are at least eighteen (18) years of age and have legal capacity to enter into these Terms;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Control the blockchain wallet that you connect to the Services;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Will provide accurate and truthful information when interacting with the Services;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Will not attempt to create multiple identities, accounts, or verification records;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Will not attempt to bypass, spoof, reuse, or manipulate identity verification mechanisms;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Will not use virtual private networks (VPNs), proxies, automation, scripts, bots, or other technical means to circumvent eligibility, jurisdictional, or verification restrictions;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Will not assist or enable any third party to do any of the foregoing;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Are not listed on, owned, or controlled by any sanctioned person or entity; and
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Will comply with all applicable laws and regulations in your jurisdiction.
                </li>
              </ul>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                You are solely responsible for compliance with local laws, including tax and reporting obligations.
              </p>
            </div>
          </section>

          {/* 3. Description of the Services */}
          <section className="flex flex-col gap-[16px] w-full">
            <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
              3. Description of the Services
            </h2>
            <div className="flex flex-col gap-[16px] opacity-[0.88]">
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                NEAR Citizen House provides a platform designed to:
              </p>
              <ul className="list-disc pl-6 flex flex-col gap-[8px]">
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Facilitate participation in governance processes within the NEAR ecosystem;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Enable users to verify that they are unique human participants through third-party identity verification providers; and
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Display governance-related information and participation status.
                </li>
              </ul>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                NEAR Citizen House does not:
              </p>
              <ul className="list-disc pl-6 flex flex-col gap-[8px]">
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Operate or control the NEAR Protocol or any blockchain network;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Guarantee eligibility, voting power, or governance outcomes;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Provide financial, custodial, brokerage, or investment services.
                </li>
              </ul>
            </div>
          </section>

          {/* 4. Identity Verification */}
          <section className="flex flex-col gap-[16px] w-full">
            <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
              4. Identity Verification
            </h2>
            <div className="flex flex-col gap-[16px] opacity-[0.88]">
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                Identity verification is performed by independent third-party providers. NEAR Citizen House does not review identity documents, store biometric data, or access passport images.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                Verification may involve the generation of cryptographic or zero-knowledge proofs confirming identity attributes. NEAR Citizen House receives only confirmation of verification status or related proofs.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                Verification status:
              </p>
              <ul className="list-disc pl-6 flex flex-col gap-[8px]">
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Does not guarantee permanent eligibility;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  May expire, be revoked, or be updated;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  May be suspended if fraud, misuse, or violations are detected.
                </li>
              </ul>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                Verification is a condition of access, not a right. NEAR Citizen House may modify, suspend, or revoke verification status at any time in its reasonable discretion, including to protect the integrity of governance processes or to comply with legal obligations.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                NEAR Citizen House may change, replace, or supplement Verification Providers at any time. Any such change may require users to re-verify, update verification information, or satisfy new verification requirements. Prior verification through a former provider does not guarantee continued access or eligibility.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                Users are subject to the terms and privacy policies of third-party verification providers.
              </p>
            </div>
          </section>

          {/* 5. Governance Participation Disclaimer */}
          <section className="flex flex-col gap-[16px] w-full">
            <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
              5. Governance Participation Disclaimer
            </h2>
            <div className="flex flex-col gap-[16px] opacity-[0.88]">
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                Governance rules, eligibility criteria, and participation mechanisms are defined by the NEAR ecosystem and may change over time.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                NEAR Citizen House:
              </p>
              <ul className="list-disc pl-6 flex flex-col gap-[8px]">
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Does not control governance decisions or outcomes;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Does not guarantee continued access or participation rights;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Is not responsible for changes made by governance bodies, protocols, or third parties.
                </li>
              </ul>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                Access to the Services may be modified or discontinued in response to governance decisions, legal requirements, or security concerns.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                NEAR Citizen House does not control governance decisions or outcomes, does not guarantee continued access or participation rights, and makes no representation that any governance participation will result in a binding, final, or enforceable outcome. Governance participation facilitated through the Services may be delayed, invalidated, reversed, or rendered ineffective due to governance decisions, protocol rules, disputes, technical issues, or third-party actions.
              </p>
            </div>
          </section>

          {/* 6. Wallets and Blockchain Networks */}
          <section className="flex flex-col gap-[16px] w-full">
            <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
              6. Wallets and Blockchain Networks
            </h2>
            <div className="flex flex-col gap-[16px] opacity-[0.88]">
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                You must use a self-custodied, NEAR-compatible wallet to interact with the Services. You are solely responsible for safeguarding your wallet credentials.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                NEAR Citizen House never has access to your private keys and cannot initiate transactions on your behalf.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                You acknowledge and accept the risks inherent in blockchain technology, including transaction irreversibility, network congestion, software errors, and third-party wallet vulnerabilities.
              </p>
            </div>
          </section>

          {/* 7. Permitted and Prohibited Use */}
          <section className="flex flex-col gap-[16px] w-full">
            <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
              7. Permitted and Prohibited Use
            </h2>
            <div className="flex flex-col gap-[16px] opacity-[0.88]">
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                You may use the Services solely for lawful governance participation, verification, and informational purposes.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                You must not:
              </p>
              <ul className="list-disc pl-6 flex flex-col gap-[8px]">
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Misrepresent your identity or eligibility;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Attempt to influence governance through multiple identities or automation;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Interfere with the security or integrity of the Services;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Use the Services for unlawful, deceptive, or abusive purposes;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Engage in any fraud, deception, or misrepresentation;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Attempt to interfere with, disrupt, overload, or compromise the Services, including through hacking, denial-of-service attacks, sybil attacks, or similar activities;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Use automated systems or scripts to access, scrape, or manipulate the Services;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Infringe or violate intellectual property, privacy, or other legal rights;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Disguise or obscure your IP address or location to evade restrictions;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Engage in any activity that undermines the integrity or fairness of governance participation; and
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Circumvent sanctions, export controls, or verification safeguards described in these Terms.
                </li>
              </ul>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                NEAR Citizen House reserves the right to investigate suspected violations of these Terms and to cooperate with governance bodies, auditors, regulators, or law enforcement authorities where reasonably necessary to protect the integrity, fairness, or legality of governance participation, subject to applicable law and our Privacy Policy.
              </p>
            </div>
          </section>

          {/* 8. Third-Party Services */}
          <section className="flex flex-col gap-[16px] w-full">
            <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
              8. Third-Party Services
            </h2>
            <div className="flex flex-col gap-[16px] opacity-[0.88]">
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                The Services may integrate or link to third-party tools, wallets, or services. NEAR Citizen House does not control and is not responsible for third-party services or their availability, accuracy, or security.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                Your use of third-party services is at your own risk and subject to their terms.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                NEAR Citizen House does not endorse, guarantee, or assume responsibility for any third-party services.
              </p>
            </div>
          </section>

          {/* 8A. Certain Risks */}
          <section className="flex flex-col gap-[16px] w-full">
            <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
              8A. Certain Risks
            </h2>
            <div className="flex flex-col gap-[16px] opacity-[0.88]">
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                You acknowledge and accept that use of the Services involves risks, including but not limited to:
              </p>
              <ul className="list-disc pl-6 flex flex-col gap-[8px]">
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Errors, outages, or changes affecting third-party identity verification providers;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  False positives or negatives in verification outcomes;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Changes to governance rules, eligibility criteria, or participation mechanisms;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Technical failures, device incompatibilities, or network disruptions;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  Security risks, including phishing or unauthorized access attempts.
                </li>
              </ul>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                NEAR Citizen House does not guarantee uninterrupted access, successful verification, or continued eligibility. The Services may be experimental, under development, or subject to change. Features, eligibility requirements, or verification mechanisms may be modified, removed, or discontinued at any time, without notice.
              </p>
            </div>
          </section>

          {/* 9. Intellectual Property */}
          <section className="flex flex-col gap-[16px] w-full">
            <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
              9. Intellectual Property
            </h2>
            <div className="flex flex-col gap-[16px] opacity-[0.88]">
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                The Services and all related content, including text, graphics, user interfaces, logos, software, and underlying code, are owned by or licensed to NEAR Citizen House and are protected by intellectual property laws.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                You are granted a personal, revocable, non-exclusive, non-transferable, and non-sublicensable license to access and use the Services solely in accordance with these Terms and solely for their intended purposes.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                You may not copy, modify, distribute, sell, lease, reverse engineer, scrape, or create derivative works from any portion of the Services except as expressly permitted by law.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                Nothing in these Terms transfers ownership of any intellectual property or governance rights to you.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                If you submit feedback, suggestions, or other non-confidential information regarding the Services, you grant NEAR Citizen House a worldwide, perpetual, irrevocable, royalty-free license to use, modify, and incorporate such feedback for any purpose without compensation or attribution.
              </p>
            </div>
          </section>

          {/* 10. Privacy */}
          <section className="flex flex-col gap-[16px] w-full">
            <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
              10. Privacy
            </h2>
            <div className="flex flex-col gap-[16px] opacity-[0.88]">
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                Our collection and use of personal information are governed by our Privacy Policy and, where applicable, the European Union &amp; United Kingdom Privacy Addendum, which are incorporated by reference. In the event of any conflict, the Privacy Policy governs matters relating to personal data.
              </p>
            </div>
          </section>

          {/* 10A. No Advice; Non-Reliance */}
          <section className="flex flex-col gap-[16px] w-full">
            <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
              10A. No Advice; Non-Reliance
            </h2>
            <div className="flex flex-col gap-[16px] opacity-[0.88]">
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                The Services are provided for informational and administrative purposes only. Nothing on the Services constitutes legal, financial, investment, governance or other professional advice. You acknowledge that you have not relied on any representations outside these Terms in deciding to use the Services.
              </p>
            </div>
          </section>

          {/* 11. No Warranties */}
          <section className="flex flex-col gap-[16px] w-full">
            <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
              11. No Warranties
            </h2>
            <div className="flex flex-col gap-[16px] opacity-[0.88]">
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                The Services are provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis, to the maximum extent permitted by applicable law. NEAR Citizen House makes no warranties of any kind, express or implied, including warranties of accuracy, availability, reliability, merchantability, fitness for a particular purpose, or non-infringement.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                Without limiting the foregoing, NEAR Citizen House does not warrant that:
              </p>
              <ul className="list-disc pl-6 flex flex-col gap-[8px]">
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  identity verification will be successful, accurate, or continuous;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  governance rules or eligibility will remain unchanged;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  the Services will be uninterrupted, timely, secure, or error-free;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  defects or errors will be corrected; or
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  the Services or any data will be free of viruses or other harmful components.
                </li>
              </ul>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                NEAR Citizen House does not guarantee availability of the Services at any specific time or location and is not responsible for failures or actions of third-party providers.
              </p>
            </div>
          </section>

          {/* 12. Limitation of Liability */}
          <section className="flex flex-col gap-[16px] w-full">
            <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
              12. Limitation of Liability
            </h2>
            <div className="flex flex-col gap-[16px] opacity-[0.88]">
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                To the maximum extent permitted by law, NEAR Citizen House shall not be liable for any indirect, incidental, consequential, special, exemplary, or punitive damages, including without limitation damages for loss of access, loss of eligibility, loss of participation rights, loss of data, loss of reputation, loss of opportunity, or loss of expected governance outcomes, arising out of or relating to your use of, inability to use, or reliance on the Services.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                Without limiting the foregoing, NEAR Citizen House shall not be liable for any damages arising from or related to:
              </p>
              <ul className="list-disc pl-6 flex flex-col gap-[8px]">
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  identity verification failures, errors, false positives or negatives, or revocation of verification status;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  decisions, rules, actions, or outcomes of any governance body, protocol, or ecosystem participant;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  changes to eligibility criteria, participation mechanisms, or governance frameworks;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  acts or omissions of third-party service providers, including identity verification providers and wallet providers;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  blockchain network failures, delays, forks, congestion, or protocol changes; or
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  unauthorized access, security breaches, or user error.
                </li>
              </ul>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                This limitation applies regardless of the legal theory asserted, whether in contract, tort, strict liability, or otherwise, even if NEAR Citizen House has been advised of the possibility of such damages.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                To the extent that any liability of NEAR Citizen House is not otherwise excluded under these Terms, NEAR Citizen House&apos;s total aggregate liability arising out of or relating to the Services or these Terms shall not exceed USD 100 (or the equivalent in local currency).
              </p>
            </div>
          </section>

          {/* 13. Indemnification */}
          <section className="flex flex-col gap-[16px] w-full">
            <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
              13. Indemnification
            </h2>
            <div className="flex flex-col gap-[16px] opacity-[0.88]">
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                You agree to defend, indemnify, and hold harmless NEAR Citizen House and its directors, officers, employees, contractors, and service providers from and against any and all claims, demands, actions, damages, losses, liabilities, costs, and expenses (including reasonable attorneys&apos; fees) arising out of or relating to:
              </p>
              <ul className="list-disc pl-6 flex flex-col gap-[8px]">
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  your access to or use of the Services;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  your violation of these Terms, applicable law, or any governance rules or eligibility requirements;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  any misrepresentation, fraud, or attempt to circumvent identity verification, eligibility, or jurisdictional restrictions;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  any claim that your participation in governance violated the rights of another participant or applicable rules;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  your use of third-party services in connection with the Services; or
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  your violation of sanctions, export controls, or jurisdictional restrictions applicable to the Services.
                </li>
              </ul>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                NEAR Citizen House reserves the right, at your expense, to assume the exclusive defense and control of any matter subject to indemnification, and you agree to cooperate fully in such defense.
              </p>
            </div>
          </section>

          {/* 14. Suspension and Termination */}
          <section className="flex flex-col gap-[16px] w-full">
            <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
              14. Suspension and Termination
            </h2>
            <div className="flex flex-col gap-[16px] opacity-[0.88]">
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                NEAR Citizen House may, in its reasonable discretion, suspend, restrict, or terminate your access to all or any portion of the Services, with or without notice, if we reasonably believe that:
              </p>
              <ul className="list-disc pl-6 flex flex-col gap-[8px]">
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  you have violated or are likely to violate these Terms or applicable law;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  you have engaged in fraud, misrepresentation, identity manipulation, or attempted circumvention of verification, eligibility, or jurisdictional restrictions;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  your continued access could compromise the integrity, fairness, or security of governance processes;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  your verification status has expired, been revoked, or is no longer supported by a third-party verification provider;
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  we are required to do so by law, regulation, court order, sanctions requirements, or governance decision; or
                </li>
                <li className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                  continued operation of the Services is no longer feasible due to technical, legal, or operational considerations.
                </li>
              </ul>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                Suspension or termination may occur without prior notice where necessary to protect the Services, governance processes, or other users.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                NEAR Citizen House shall have no liability to you for any suspension, restriction, or termination of access, including any resulting loss of eligibility, participation, or governance-related opportunities. Suspension or termination does not relieve you of any obligations incurred prior to such action.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                NEAR Citizen House has no obligation to provide advance notice or an opportunity to cure where immediate action is reasonably required to protect the Services, governance integrity, or compliance obligations.
              </p>
            </div>
          </section>

          {/* 15. Governing Law and Dispute Resolution */}
          <section className="flex flex-col gap-[16px] w-full">
            <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
              15. Governing Law and Dispute Resolution
            </h2>
            <div className="flex flex-col gap-[16px] opacity-[0.88]">
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                These Terms are governed by and construed in accordance with the laws of the Cayman Islands, without regard to conflict-of-law principles.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                Any dispute, claim, or controversy arising out of or relating to the Services or these Terms shall be finally and exclusively resolved by binding arbitration administered by the London Court of International Arbitration (LCIA) in accordance with its rules in effect at the time the arbitration is initiated. The arbitration shall be conducted before a single arbitrator, in the English language, and the seat of arbitration shall be London, United Kingdom.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                Before initiating arbitration, the parties agree to attempt in good faith to resolve any dispute informally.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                You waive any right to participate in a class action, collective action, private attorney general action, or jury trial.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                Nothing in this section prevents NEAR Citizen House from seeking injunctive or equitable relief in any court of competent jurisdiction to protect its intellectual property, security, or governance integrity.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                This section survives termination of these Terms. Any claim arising out of or relating to these Terms or the Services must be brought within one (1) year after the claim arises, or it is permanently barred.
              </p>
            </div>
          </section>

          {/* 16. Changes to These Terms */}
          <section className="flex flex-col gap-[16px] w-full">
            <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
              16. Changes to These Terms
            </h2>
            <div className="flex flex-col gap-[16px] opacity-[0.88]">
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                We may modify these Terms at any time in our discretion. Updated Terms will be posted on the Services with a revised &ldquo;Last updated&rdquo; date. Continued use of the Services after any such changes constitutes acceptance of the revised Terms.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                If you do not agree to the revised Terms, your sole remedy is to discontinue use of the Services.
              </p>
            </div>
          </section>

          {/* 17. Legal Limitations on Disclaimers */}
          <section className="flex flex-col gap-[16px] w-full">
            <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
              17. Legal Limitations on Disclaimers
            </h2>
            <div className="flex flex-col gap-[16px] opacity-[0.88]">
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                Some jurisdictions do not allow certain limitations or exclusions of liability. To the extent any provision of these Terms is held unenforceable under applicable law, such provision shall be limited or severed only to the extent necessary, and the remaining provisions shall remain in full force and effect.
              </p>
            </div>
          </section>

          {/* 18. Entire Agreement */}
          <section className="flex flex-col gap-[16px] w-full">
            <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
              18. Entire Agreement
            </h2>
            <div className="flex flex-col gap-[16px] opacity-[0.88]">
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                These Terms, together with the Privacy Policy and any expressly incorporated policies or addenda, constitute the entire agreement between you and NEAR Citizen House regarding the Services and supersede all prior or contemporaneous understandings, agreements, representations, or communications, whether written or oral. Sections relating to intellectual property, limitations of liability, indemnification, dispute resolution, and any provisions which by their nature should survive termination shall survive termination of these Terms.
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                In the event of any conflict between these Terms and any other referenced policy, these Terms control unless expressly stated otherwise.
              </p>
            </div>
          </section>

          {/* 19. No Waiver */}
          <section className="flex flex-col gap-[16px] w-full">
            <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
              19. No Waiver
            </h2>
            <div className="flex flex-col gap-[16px] opacity-[0.88]">
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                Failure by NEAR Citizen House to enforce any provision of these Terms shall not constitute a waiver of that provision or any other provision. Any waiver must be in writing and signed by an authorized representative of NEAR Citizen House.
              </p>
            </div>
          </section>

          {/* 20. Force Majeure */}
          <section className="flex flex-col gap-[16px] w-full">
            <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
              20. Force Majeure
            </h2>
            <div className="flex flex-col gap-[16px] opacity-[0.88]">
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                NEAR Citizen House shall not be liable for any failure or delay resulting from events beyond its reasonable control, including acts of God, network failures, governmental actions, or third-party outages.
              </p>
            </div>
          </section>

          {/* 21. Assignment */}
          <section className="flex flex-col gap-[16px] w-full">
            <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
              21. Assignment
            </h2>
            <div className="flex flex-col gap-[16px] opacity-[0.88]">
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                You may not assign these Terms without our prior written consent. NEAR Citizen House may assign these Terms in connection with a merger, restructuring, or transfer of assets.
              </p>
            </div>
          </section>

          {/* 22. Electronic Communications */}
          <section className="flex flex-col gap-[16px] w-full">
            <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
              22. Electronic Communications
            </h2>
            <div className="flex flex-col gap-[16px] opacity-[0.88]">
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                You consent to receive all communications, notices, disclosures, and agreements electronically. Your acceptance of these Terms via the Services constitutes your electronic signature.
              </p>
            </div>
          </section>

          {/* 23. Contact Information */}
          <section className="flex flex-col gap-[16px] w-full">
            <h2 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
              23. Contact Information
            </h2>
            <div className="flex flex-col gap-[16px] opacity-[0.88]">
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                For questions regarding these Terms, please contact:
              </p>
              <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5]">
                Email: info@citizenshouse.org
              </p>
            </div>
          </section>
        </article>
      </section>
    </div>
  )
}
