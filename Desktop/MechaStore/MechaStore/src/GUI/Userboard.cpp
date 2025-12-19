//---------------------------------------------------------------------------

#include <vcl.h>
#pragma hdrstop

#include "Userboard.h"
#include "BrowseComp.h"
#include "AddComponent.h"
#include "ViewCart.h"
#include "Login.h"
#include "AddinCart.h"

//---------------------------------------------------------------------------
#pragma package(smart_init)
#pragma resource "*.dfm"
TUserDashboard *UserDashboard;
//---------------------------------------------------------------------------
__fastcall TUserDashboard::TUserDashboard(TComponent* Owner)
	: TForm(Owner)
{
}
//---------------------------------------------------------------------------
void __fastcall TUserDashboard::browseComponentsClick(TObject *Sender)
{
	TBrowseComp *BrowseForm = new TBrowseComp(this);
	BrowseForm->show();
}
//---------------------------------------------------------------------------

void __fastcall TUserDashboard::AddComponentClick(TObject *Sender)
{
	TAddComponent *addcomponent = new TAddComponent(this);
	addcomponent->show();
}
//---------------------------------------------------------------------------

void __fastcall TUserDashboard::AddtoCartClick(TObject *Sender)
{
	TAddinCart *AddtoCartForm = new TAddinCart(this);
	AddtoCartForm->show();
}
//---------------------------------------------------------------------------


void __fastcall TUserDashboard::ViewCartClick(TObject *Sender)
{
	TViewCart *ViewCart = new TViewCart(this);
	ViewCart->show();
}
//---------------------------------------------------------------------------

void __fastcall TUserDashboard::CheckOutClick(TObject *Sender)
{
    TCheckOut *checkoutForm = new TCheckout(this);
	checkoutForm->Show();
}
//---------------------------------------------------------------------------

void __fastcall TUserDashboard::LogOutClick(TObject *Sender)
{
	this->close();
    Login->show();
}
//---------------------------------------------------------------------------

