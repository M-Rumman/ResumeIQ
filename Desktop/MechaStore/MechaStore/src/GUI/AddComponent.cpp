#include <vcl.h>
#pragma hdrstop

#include "AddComponent.h"
#include "../models/PortalManager.h"
#include "../models/Component.h"

#pragma package(smart_init)
#pragma resource "*.dfm"

extern PortalManager store;

// Constructor
__fastcall TAddComponentPortal::TAddComponentPortal(TComponent* Owner, User *u)
    : TForm(Owner), loggedInUser(u)
{
}

// Button Click
void __fastcall TAddComponentPortal::btnAddClick(TObject *Sender)
{
    // Basic validation
    if (edtName->Text.IsEmpty() || edtQty->Text.IsEmpty() || edtPrice->Text.IsEmpty())
    {
        ShowMessage("Please fill all required fields");
        return;
    }

    int id = store.getComponents().size() + 1;

	Component c(
    id,
    std::string(AnsiString(edtName->Text).c_str()),
    std::string(AnsiString(edtDesc->Text).c_str()),
    edtQty->Text.ToInt(),
    edtPrice->Text.ToDouble(),
    std::string(AnsiString(edtSeller->Text).c_str()),
    std::string(AnsiString(edtPhone->Text).c_str())
);


    store.addComponent(c);
    store.saveComponents();

    ShowMessage("Component added successfully!");
	Close();
}

void __fastcall TAddComponentPortal::edtDescChange(TObject *Sender)
{

}
//---------------------------------------------------------------------------

void __fastcall TAddComponentPortal::edtPriceChange(TObject *Sender)
{

}
//---------------------------------------------------------------------------

void __fastcall TAddComponentPortal::edtQtyChange(TObject *Sender)
{

}
//---------------------------------------------------------------------------

void __fastcall TAddComponentPortal::edtSellerChange(TObject *Sender)
{

}
//---------------------------------------------------------------------------

void __fastcall TAddComponentPortal::edtPhoneChange(TObject *Sender)
{

}
//---------------------------------------------------------------------------

void __fastcall TAddComponentPortal::edtNameChange(TObject *Sender)
{

}
//---------------------------------------------------------------------------

