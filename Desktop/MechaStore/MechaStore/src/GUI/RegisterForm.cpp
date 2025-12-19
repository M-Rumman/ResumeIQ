#include <vcl.h>
#pragma hdrstop

#include "RegisterForm.h"
#include "../models/Customer.h"
#include "../models/PortalManager.h"

extern PortalManager store;

#pragma package(smart_init)
#pragma resource "*.dfm"

TRegister *Register;

__fastcall TRegister::TRegister(TComponent* Owner)
    : TForm(Owner)
{
}

void __fastcall TRegister::btnRegisterClick(TObject *Sender)
{
	string user  = AnsiString(edtUsername->Text).c_str();
	string pass  = AnsiString(edtPassword->Text).c_str();
	string phone = AnsiString(edtWhatsapp->Text).c_str();


    // Create new Customer dynamically
	Customer *c = new Customer(store.generateUserId(), user, pass, phone);

	store.registerUser(c);  // Add to backend
	store.saveUsers();

    ShowMessage("Registration successful!");
    Close();  // Close the registration form
}










