#include <vcl.h>
#pragma hdrstop

#include "Main.h"
#include "RegisterForm.h"
#include "Login.h"
#include "BrowseComp.h"
#include "../models/PortalManager.h"

extern PortalManager store;

#pragma package(smart_init)
#pragma resource "*.dfm"

TMainForm *MainForm;

__fastcall TMainForm::TMainForm(TComponent* Owner)
	: TForm(Owner)
{
	/*store.addComponent(Component(
	1, "Resistor", "10k Ohm resistor", 100, 0.10, "Ali Electronics", "03001234567"
));

store.addComponent(Component(
	2, "Capacitor", "100uF capacitor", 50, 0.25, "Bilal Traders", "03007654321"
));

store.addComponent(Component(
	3, "LED", "Red LED 5mm", 200, 0.15, "Shah Electronics", "03009876543"
));   */

}

void __fastcall TMainForm::btnRegisterClick(TObject *Sender)
{
    // Create Register form dynamically
    TRegister *regForm = new TRegister(this);
    regForm->ShowModal();   // Blocking call until user closes the form
    delete regForm;         // Free memory
}

void __fastcall TMainForm::btnLoginClick(TObject *Sender)
{
    TLoginForm *loginForm = new TLoginForm(Application);
    loginForm->store = &store;

    // Assign proper OnClose handler
    loginForm->OnClose = loginForm->loginFormClose;

    loginForm->Show(); // Non-blocking
}


void __fastcall TMainForm::btnBrowseClick(TObject *Sender)
{
    // Create BrowseComponents form dynamically
    TBrowseComponents *browseForm = new TBrowseComponents(this);

    // Pass backend reference
	//browseForm->store = &store;

    browseForm->ShowModal();  // Blocking call
    delete browseForm;
}

void __fastcall TMainForm::btnExitClick(TObject *Sender)
{
    Close();
}


