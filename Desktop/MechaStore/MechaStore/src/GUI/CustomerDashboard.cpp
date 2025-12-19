#include <vcl.h>
#pragma hdrstop

#include "CustomerDashboard.h"
#include "BrowseComp.h"
#include "AddComponent.h"
#include "AddinCart.h"
#include "ViewCart.h"
#include "CheckOut.h"
#include "Main.h"

#pragma package(smart_init)
#pragma resource "*.dfm"

TUserDashboard *UserDashboard;

__fastcall TUserDashboard::TUserDashboard(TComponent* Owner, User* u)
    : TForm(Owner), loggedInUser(u)
{
}

void __fastcall TUserDashboard::dashboardClose(TObject *Sender, TCloseAction &Action)
{
    Action = caFree;
    MainForm->Show();
}

void __fastcall TUserDashboard::browseComponentsClick(TObject *Sender)
{
    TBrowseComponents *browse = new TBrowseComponents(Application);
    browse->ShowModal();
    delete browse;
}

void __fastcall TUserDashboard::AddComponentClick(TObject *Sender)
{
    TAddComponentPortal *addForm =
        new TAddComponentPortal(Application, loggedInUser);
    addForm->ShowModal();
    delete addForm;
}

void __fastcall TUserDashboard::AddtoCartClick(TObject *Sender)
{
    TAddToCartForm *cartForm =
        new TAddToCartForm(Application, loggedInUser, cartItems);
    cartForm->ShowModal();
    delete cartForm;
}

void __fastcall TUserDashboard::ViewCartClick(TObject *Sender)
{
    TCartView *view = new TCartView(Application);
    view->setCartItems(cartItems);
    view->ShowModal();
    delete view;
}

void __fastcall TUserDashboard::CheckOutClick(TObject *Sender)
{
    if (cartItems.empty())
    {
        ShowMessage("Cart is empty!");
        return;
    }

    TCheckOutForm *checkout = new TCheckOutForm(Application);
    checkout->setCartItems(cartItems);

    checkout->ShowModal();

    if (checkout->isOrderPlaced())
    {
        cartItems.clear();   // ? cart cleared only after successful order
    }

    delete checkout;
}


void __fastcall TUserDashboard::LogOutClick(TObject *Sender)
{
    Close();
}

