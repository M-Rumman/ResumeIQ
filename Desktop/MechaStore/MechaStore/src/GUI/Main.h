#ifndef MainMenuH
#define MainMenuH

#include <System.Classes.hpp>
#include <Vcl.Controls.hpp>
#include <Vcl.StdCtrls.hpp>
#include <Vcl.Forms.hpp>
#include "../models/PortalManager.h"

class TMainForm : public TForm
{
__published:
	TButton *btnRegister;
	TButton *btnLogin;
	TButton *btnBrowse;
	TButton *btnExit;

	void __fastcall btnRegisterClick(TObject *Sender);
	void __fastcall btnLoginClick(TObject *Sender);
	void __fastcall btnBrowseClick(TObject *Sender);
	void __fastcall btnExitClick(TObject *Sender);

private:
public:
    __fastcall TMainForm(TComponent* Owner);
};

extern PACKAGE TMainForm *MainForm;

#endif

