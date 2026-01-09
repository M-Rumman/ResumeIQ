#include <vcl.h>
#pragma hdrstop

#include "Login.h"
#include "CustomerDashboard.h"
#include "../models/PortalManager.h"

extern PortalManager store;

#pragma package(smart_init)
#pragma resource "*.dfm"

TLoginForm *LoginForm;

__fastcall TLoginForm::TLoginForm(TComponent* Owner)
    : TForm(Owner)
{
}

void __fastcall TLoginForm::btnLoginClick(TObject *Sender)
{
    std::string u = AnsiString(edtUser->Text).c_str();
    std::string p = AnsiString(edtPass->Text).c_str();

    User* user = store->login(u, p);
    if (user)
    {
        TUserDashboard *dash =
            new TUserDashboard(Application, user);

        dash->OnClose = dash->dashboardClose;
        dash->Show();
        Hide();
    }
    else
    {
        ShowMessage("Invalid credentials");
    }
}

void __fastcall TLoginForm::loginFormClose(TObject *Sender, TCloseAction &Action)
{
    Action = caFree;
}


