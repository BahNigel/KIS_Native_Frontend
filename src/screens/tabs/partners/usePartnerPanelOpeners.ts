type PanelOpeners = {
  closePanel: () => void;
  openRecruitment: () => void;
  openAudit: () => void;
  openPolicy: () => void;
  openIntegrations: () => void;
  openAutomation: () => void;
  openReports: () => void;
  openGovernance: () => void;
};

export const usePartnerPanelOpeners = ({
  closePanel,
  openRecruitment,
  openAudit,
  openPolicy,
  openIntegrations,
  openAutomation,
  openReports,
  openGovernance,
}: PanelOpeners) => {
  return {
    handleOpenRecruitment: () => {
      closePanel();
      openRecruitment();
    },
    handleOpenAudit: () => {
      closePanel();
      openAudit();
    },
    handleOpenPolicy: () => {
      closePanel();
      openPolicy();
    },
    handleOpenIntegrations: () => {
      closePanel();
      openIntegrations();
    },
    handleOpenAutomation: () => {
      closePanel();
      openAutomation();
    },
    handleOpenReports: () => {
      closePanel();
      openReports();
    },
    handleOpenGovernance: () => {
      closePanel();
      openGovernance();
    },
  };
};
