#ifndef RegisterFormH
#define RegisterFormH

#include <System.Classes.hpp>
#include <Vcl.Controls.hpp>
#include <Vcl.StdCtrls.hpp>
#include <Vcl.Forms.hpp>

class TRegister : public TForm
{
__published:
	TLabel *Label1;
	TButton *btnRegister;
	TEdit *edtUsername;
	TEdit *edtPassword;
	TEdit *edtWhatsapp;

	void __fastcall btnRegisterClick(TObject *Sender);

private:
public:
	__fastcall TRegister(TComponent* Owner);
};

extern PACKAGE TRegister *Register;

#endif

