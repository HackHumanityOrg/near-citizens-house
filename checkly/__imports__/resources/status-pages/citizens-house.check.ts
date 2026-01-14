import { StatusPage, StatusPageService } from "checkly/constructs"

const webAppService = new StatusPageService("citizens-house-web", {
  name: "Citizens House Web App",
})

const nearContractService = new StatusPageService("near-contract-service", {
  name: "NEAR Verified Accounts Contract",
})

new StatusPage("citizens-house-uGXtVeBx", {
  name: "Citizens House Status",
  url: "tccg069s",
  cards: [
    {
      name: "Core Services",
      services: [webAppService, nearContractService],
    },
  ],
  defaultTheme: "AUTO",
})
