//---------------------------------------------------------------------------

#ifndef AddComponentH
#define AddComponentH
//---------------------------------------------------------------------------
#include <System.Classes.hpp>
#include <Vcl.Controls.hpp>
#include <Vcl.StdCtrls.hpp>
#include <Vcl.Forms.hpp>

#include "../models/User.h"
//---------------------------------------------------------------------------
class TAddComponentPortal : public TForm
{
__published:	// IDE-managed Components
	TEdit *edtDesc;
	TEdit *edtPrice;
	TEdit *edtQty;
	TEdit *edtSeller;
	TEdit *edtPhone;
	TButton *btnAdd;
	TEdit *edtName;
	void __fastcall btnAddClick(TObject *Sender);
	void __fastcall edtDescChange(TObject *Sender);
	void __fastcall edtPriceChange(TObject *Sender);
	void __fastcall edtQtyChange(TObject *Sender);
	void __fastcall edtSellerChange(TObject *Sender);
	void __fastcall edtPhoneChange(TObject *Sender);
	void __fastcall edtNameChange(TObject *Sender);
private:
	User *loggedInUser;	// User declarations
public:		// User declarations
	__fastcall TAddComponentPortal(TComponent* Owner, User *u);
};
//---------------------------------------------------------------------------
extern PACKAGE TAddComponentPortal *AddComponentPortal;
//---------------------------------------------------------------------------
#endif
