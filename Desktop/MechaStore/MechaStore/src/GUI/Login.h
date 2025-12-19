#ifndef LoginH
#define LoginH

#include <System.Classes.hpp>
#include <Vcl.Controls.hpp>
#include <Vcl.StdCtrls.hpp>
#include <Vcl.Forms.hpp>
#include "../models/PortalManager.h"

class TLoginForm : public TForm
{
__published:
	TEdit *edtUser;
	TEdit *edtPass;
	TButton *btnLogin;
	TLabel *Label1;

    void __fastcall btnLoginClick(TObject *Sender);

private:
public:
	PortalManager *store;
    void __fastcall loginFormClose(TObject *Sender, TCloseAction &Action);
    __fastcall TLoginForm(TComponent* Owner);
};

extern PACKAGE TLoginForm *LoginForm;

#endif

