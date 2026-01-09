#ifndef AddComponentH
#define AddComponentH

#include <System.Classes.hpp>
#include <Vcl.Controls.hpp>
#include <Vcl.StdCtrls.hpp>
#include <Vcl.Forms.hpp>

class TAddComponentAdmin : public TForm
{
__published:
	TEdit *Name;
	TEdit *Price;
	TEdit *Quantity;
	TButton *Save;

	void __fastcall SaveClick(TObject *Sender);

public:
	__fastcall TAddComponentAdmin(TComponent* Owner);
};

extern PACKAGE TAddComponentAdmin *AddComponentAdmin;

#endif

