#ifndef UpdateComponentH
#define UpdateComponentH

#include <System.Classes.hpp>
#include <Vcl.Controls.hpp>
#include <Vcl.StdCtrls.hpp>
#include <Vcl.Forms.hpp>

class TUpdateComponentAdmin : public TForm
{
__published:
	TEdit *ID;
	TEdit *NewPrice;
	TButton *Update;

	void __fastcall UpdateClick(TObject *Sender);

public:
	__fastcall TUpdateComponentAdmin(TComponent* Owner);
};

extern PACKAGE TUpdateComponentAdmin *UpdateComponentAdmin;

#endif

