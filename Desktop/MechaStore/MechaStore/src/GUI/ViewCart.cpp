#include <vcl.h>
#pragma hdrstop

#include "ViewCart.h"

#pragma package(smart_init)
#pragma resource "*.dfm"

TCartView *CartView;

__fastcall TCartView::TCartView(TComponent* Owner)
    : TForm(Owner)
{
}


void __fastcall TCartView::CloseCartClick(TObject *Sender)
{
    this->Close();
}
//---------------------------------------------------------------------------



